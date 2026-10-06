import json
import sqlite3
import time
import uuid
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from litert_lm.engine import Engine

ROOT = Path("/storage/emulated/0/Gemma4Chatbot")
DB = ROOT / "kivo.db"
WEB = ROOT / "web-ai"

MODEL = "/storage/emulated/0/KivoModels/gemma-4-E2B/gemma-4-E2B-it.litertlm"
HOST = "127.0.0.1"
PORT = 3001

print("Loading Gemma E2B...", flush=True)

engine = Engine(
    model_path=MODEL,
    max_num_tokens=1024,
)

print("Gemma E2B engine ready.", flush=True)

conversations = {}
gemma_lock = threading.Lock()


def db():
    return sqlite3.connect(DB)


def now():
    return int(time.time() * 1000)


def create_conversation(title):
    conversation_id = str(uuid.uuid4())
    timestamp = now()

    with db() as conn:
        conn.execute(
            """
            INSERT INTO conversations
            (id, title, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            """,
            (conversation_id, title, timestamp, timestamp),
        )

    return conversation_id


def conversation_exists(conversation_id):
    with db() as conn:
        row = conn.execute(
            "SELECT id FROM conversations WHERE id = ?",
            (conversation_id,),
        ).fetchone()

    return row is not None


def add_message(conversation_id, role, text):
    timestamp = now()

    with db() as conn:
        conn.execute(
            """
            INSERT INTO messages
            (conversation_id, role, text, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (conversation_id, role, text, timestamp),
        )

        conn.execute(
            """
            UPDATE conversations
            SET updated_at = ?
            WHERE id = ?
            """,
            (timestamp, conversation_id),
        )


def get_messages(conversation_id):
    with db() as conn:
        rows = conn.execute(
            """
            SELECT role, text, created_at
            FROM messages
            WHERE conversation_id = ?
            ORDER BY id ASC
            """,
            (conversation_id,),
        ).fetchall()

    return [
        {
            "type": "user" if role == "user" else "bot",
            "text": text,
            "createdAt": created_at,
        }
        for role, text, created_at in rows
    ]


def get_conversations():
    with db() as conn:
        rows = conn.execute(
            """
            SELECT id, title, created_at, updated_at,
                   pinned, archived
            FROM conversations
            WHERE archived = 0
            ORDER BY updated_at DESC
            """
        ).fetchall()

    result = []

    for row in rows:
        conversation_id, title, created_at, updated_at, pinned, archived = row

        result.append(
            {
                "id": conversation_id,
                "title": title,
                "createdAt": created_at,
                "updatedAt": updated_at,
                "pinned": bool(pinned),
                "archived": bool(archived),
                "messages": get_messages(conversation_id),
            }
        )

    return result


def delete_conversation(conversation_id):
    with db() as conn:
        cursor = conn.execute(
            "DELETE FROM conversations WHERE id = ?",
            (conversation_id,),
        )

    conversations.pop(conversation_id, None)

    return cursor.rowcount > 0


def extract_text(value):
    if isinstance(value, str):
        return value

    if isinstance(value, dict):
        for key in ("text", "content", "contents", "message", "response"):
            if key in value:
                result = extract_text(value[key])
                if result:
                    return result

        parts = []

        for item in value.values():
            result = extract_text(item)

            if result:
                parts.append(result)

        return "".join(parts)

    if isinstance(value, (list, tuple)):
        return "".join(
            extract_text(item)
            for item in value
        )

    return ""


def get_gemma_conversation(conversation_id):
    conversation = conversations.get(conversation_id)

    if conversation is not None:
        return conversation

    conversation = engine.create_conversation()

    conversations[conversation_id] = conversation

    return conversation


def generate(message, conversation_id):
    with gemma_lock:
        conversation = get_gemma_conversation(conversation_id)

        result = conversation.send_message(
            message,
            max_output_tokens=1024,
        )

        reply = extract_text(result).strip()

        if not reply:
            raise RuntimeError(
                "Gemma returned an empty response."
            )

        return reply


class Handler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        return

    def send_json(self, status, data):
        body = json.dumps(
            data,
            ensure_ascii=False,
        ).encode("utf-8")

        self.send_response(status)

        self.send_header(
            "Content-Type",
            "application/json; charset=utf-8",
        )

        self.send_header(
            "Content-Length",
            str(len(body)),
        )

        self.send_header(
            "Access-Control-Allow-Origin",
            "*",
        )

        self.send_header(
            "Cache-Control",
            "no-store",
        )

        self.end_headers()

        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)

        self.send_header(
            "Access-Control-Allow-Origin",
            "*",
        )

        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type",
        )

        self.send_header(
            "Access-Control-Allow-Methods",
            "GET, POST, DELETE, OPTIONS",
        )

        self.end_headers()

    def do_GET(self):

        if self.path == "/health":
            self.send_json(
                200,
                {
                    "status": "ok",
                    "model": "gemma-4-E2B",
                    "runtime": "LiteRT-LM 0.17.1",
                },
            )
            return

        if self.path == "/conversations":
            self.send_json(
                200,
                {
                    "conversations": get_conversations()
                },
            )
            return

        if self.path == "/" or self.path == "/web-ai":
            self.send_response(302)
            self.send_header(
                "Location",
                "/web-ai/",
            )
            self.end_headers()
            return

        if self.path == "/web-ai/":
            path = WEB / "index.html"

            if path.exists():
                body = path.read_bytes()

                self.send_response(200)
                self.send_header(
                    "Content-Type",
                    "text/html; charset=utf-8",
                )
                self.send_header(
                    "Content-Length",
                    str(len(body)),
                )
                self.end_headers()
                self.wfile.write(body)
                return

        if self.path.startswith("/web-ai/"):
            relative = self.path[len("/web-ai/"):]

            path = WEB / relative

            if path.is_file():
                body = path.read_bytes()

                content_type = "application/octet-stream"

                if path.suffix == ".js":
                    content_type = "text/javascript; charset=utf-8"
                elif path.suffix == ".css":
                    content_type = "text/css; charset=utf-8"
                elif path.suffix == ".html":
                    content_type = "text/html; charset=utf-8"

                self.send_response(200)
                self.send_header(
                    "Content-Type",
                    content_type,
                )
                self.send_header(
                    "Content-Length",
                    str(len(body)),
                )
                self.end_headers()
                self.wfile.write(body)
                return

        self.send_json(
            404,
            {"error": "Not found"},
        )

    def do_POST(self):

        if self.path != "/chat":
            self.send_json(
                404,
                {"error": "Not found"},
            )
            return

        try:
            length = int(
                self.headers.get(
                    "Content-Length",
                    "0",
                )
            )

            payload = json.loads(
                self.rfile.read(length).decode("utf-8")
            )

            message = str(
                payload.get("message", "")
            ).strip()

            conversation_id = str(
                payload.get("conversationId", "")
            ).strip()

            if not message:
                self.send_json(
                    400,
                    {"error": "Message is required."},
                )
                return

            if not conversation_id:
                title = (
                    message[:50] + "..."
                    if len(message) > 50
                    else message
                )

                conversation_id = create_conversation(
                    title
                )

            elif not conversation_exists(
                conversation_id
            ):
                self.send_json(
                    404,
                    {"error": "Conversation not found"},
                )
                return

            add_message(
                conversation_id,
                "user",
                message,
            )

            reply = generate(
                message,
                conversation_id,
            )

            add_message(
                conversation_id,
                "model",
                reply,
            )

            self.send_json(
                200,
                {
                    "conversationId": conversation_id,
                    "reply": reply,
                    "history": get_messages(
                        conversation_id
                    ),
                },
            )

        except Exception as error:
            print(
                "Gemma error:",
                repr(error),
                flush=True,
            )

            self.send_json(
                500,
                {"error": str(error)},
            )

    def do_DELETE(self):

        prefix = "/conversations/"

        if not self.path.startswith(prefix):
            self.send_json(
                404,
                {"error": "Not found"},
            )
            return

        conversation_id = self.path[len(prefix):]

        conversation_id = conversation_id.strip()

        if not conversation_id:
            self.send_json(
                400,
                {"error": "Conversation ID required"},
            )
            return

        deleted = delete_conversation(
            conversation_id
        )

        self.send_json(
            200,
            {"success": deleted},
        )


server = ThreadingHTTPServer(
    (HOST, PORT),
    Handler,
)

print(
    f"Kivo Gemma Web server running on "
    f"http://{HOST}:{PORT}",
    flush=True,
)

try:
    server.serve_forever()

except KeyboardInterrupt:
    print(
        "\nStopping Kivo Gemma server...",
        flush=True,
    )

finally:
    server.server_close()
    engine.close()
