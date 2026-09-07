const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");
const { GoogleGenAI } = require("@google/genai");

const app = express();

const PORT = 3000;
const MODEL = "gemini-3-flash-preview";
const MAX_MESSAGES = 40;
const MAX_MEMORY_ITEMS = 100;

app.use(cors());
app.use(express.json({ limit: "1mb" }));


/* =========================
   GEMINI
========================= */

const apiKey = process.env.GEMINI_API_KEY;

const ai = apiKey
    ? new GoogleGenAI({ apiKey })
    : null;


/* =========================
   SQLITE
========================= */

const db = new DatabaseSync("./kivo.db");

db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        pinned INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at INTEGER NOT NULL,

        FOREIGN KEY (conversation_id)
        REFERENCES conversations(id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );
`);


/* =========================
   SAFE MIGRATIONS
========================= */

function ensureColumn(
    table,
    column,
    definition
) {

    const columns =
        db.prepare(
            `PRAGMA table_info(${table})`
        ).all();


    const exists =
        columns.some(
            item =>
                item.name === column
        );


    if (!exists) {

        db.exec(
            `ALTER TABLE ${table}
             ADD COLUMN ${column}
             ${definition}`
        );

    }

}


ensureColumn(
    "conversations",
    "pinned",
    "INTEGER NOT NULL DEFAULT 0"
);


ensureColumn(
    "conversations",
    "archived",
    "INTEGER NOT NULL DEFAULT 0"
);


/* =========================
   MEMORY
========================= */

function saveMemory(
    key,
    value
) {

    const now = Date.now();

    db.prepare(`
        INSERT INTO memories
        (
            key,
            value,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?)

        ON CONFLICT(key)
        DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at
    `).run(
        key,
        value,
        now,
        now
    );

}


function getMemories() {

    return db.prepare(`
        SELECT
            key,
            value
        FROM memories
        ORDER BY updated_at DESC
        LIMIT ?
    `).all(
        MAX_MEMORY_ITEMS
    );

}


function getMemory(
    key
) {

    return db.prepare(`
        SELECT
            key,
            value
        FROM memories
        WHERE key = ?
    `).get(
        key
    );

}


function deleteMemory(
    key
) {

    return db.prepare(`
        DELETE FROM memories
        WHERE key = ?
    `).run(
        key
    );

}


/* =========================
   CONVERSATION HELPERS
========================= */

function createConversation(
    id,
    title
) {

    const now = Date.now();

    db.prepare(`
        INSERT INTO conversations
        (
            id,
            title,
            created_at,
            updated_at,
            pinned,
            archived
        )
        VALUES (?, ?, ?, ?, 0, 0)
    `).run(
        id,
        title,
        now,
        now
    );

}


function addMessage(
    conversationId,
    role,
    text
) {

    const now = Date.now();

    db.prepare(`
        INSERT INTO messages
        (
            conversation_id,
            role,
            text,
            created_at
        )
        VALUES (?, ?, ?, ?)
    `).run(
        conversationId,
        role,
        text,
        now
    );


    db.prepare(`
        UPDATE conversations
        SET updated_at = ?
        WHERE id = ?
    `).run(
        now,
        conversationId
    );

}


function getMessages(
    conversationId
) {

    return db.prepare(`
        SELECT
            id,
            role,
            text,
            created_at
        FROM messages
        WHERE conversation_id = ?
        ORDER BY id ASC
    `).all(
        conversationId
    );

}


function getConversation(
    conversationId
) {

    const conversation =
        db.prepare(`
            SELECT
                id,
                title,
                created_at,
                updated_at,
                pinned,
                archived
            FROM conversations
            WHERE id = ?
        `).get(
            conversationId
        );


    if (!conversation) {
        return null;
    }


    const messages =
        getMessages(
            conversationId
        );


    return {

        id:
            conversation.id,

        title:
            conversation.title,

        createdAt:
            conversation.created_at,

        updatedAt:
            conversation.updated_at,

        pinned:
            Boolean(
                conversation.pinned
            ),

        archived:
            Boolean(
                conversation.archived
            ),

        messages:
            messages.map(
                message => ({

                    text:
                        message.text,

                    type:
                        message.role === "user"
                            ? "user"
                            : "bot",

                    createdAt:
                        message.created_at

                })
            )

    };

}


/* =========================
   MEMORY CONTEXT
========================= */

function buildMemoryContext() {

    const memories =
        getMemories();


    if (
        !memories ||
        memories.length === 0
    ) {

        return `
No saved user memories exist.
`;

    }


    return `
PERSISTENT USER MEMORIES:

${memories
    .map(
        memory =>
            `- ${memory.key}: ${memory.value}`
    )
    .join("\n")}

Use these memories when relevant.
Never invent memories.
`;

}


/* =========================
   SYSTEM PROMPT
========================= */

function buildSystemInstruction() {

    return `
You are Kivo, a helpful AI assistant.

Respond naturally, clearly, accurately,
and helpfully.

Support the user's language whenever
possible.

Maintain conversation context.

${buildMemoryContext()}

IMPORTANT:

If a saved memory contains information
relevant to the user's question, use it.

Never claim that the user has not told you
something when that information exists in
the persistent memory.

Never invent personal information.

If the user explicitly asks you to remember
a fact, the application may save it as a
persistent memory.
`;

}


/* =========================
   AUTOMATIC MEMORY
========================= */

function detectMemoryRequest(
    message
) {

    const text =
        message.trim();


    const patterns = [

        /^(?:my name is|i am|i'm)\s+(.+)$/i,

        /^আমার নাম\s+(.+)$/i,

        /^আমার নাম হলো\s+(.+)$/i,

        /^আমার নাম হচ্ছে\s+(.+)$/i

    ];


    for (
        const pattern of patterns
    ) {

        const match =
            text.match(pattern);


        if (
            match &&
            match[1]
        ) {

            return {

                key:
                    "user_name",

                value:
                    match[1].trim()

            };

        }

    }


    return null;

}


/* =========================
   HOME
========================= */

app.get(
    "/",
    (req, res) => {

        res.json({

            name:
                "Kivo",

            status:
                "online",

            database:
                "sqlite",

            aiConfigured:
                Boolean(ai),

            model:
                MODEL

        });

    }
);


/* =========================
   HEALTH
========================= */

app.get(
    "/health",
    (req, res) => {

        res.json({

            status:
                "ok",

            aiConfigured:
                Boolean(ai),

            database:
                "sqlite",

            model:
                MODEL

        });

    }
);


/* =========================
   CONVERSATIONS
========================= */

app.get(
    "/conversations",
    (req, res) => {

        try {

            const rows =
                db.prepare(`
                    SELECT
                        id,
                        title,
                        created_at,
                        updated_at,
                        pinned,
                        archived
                    FROM conversations

                    WHERE id IN (
                        SELECT DISTINCT
                            conversation_id
                        FROM messages
                    )

                    ORDER BY
                        pinned DESC,
                        updated_at DESC
                `).all();


            const conversations =
                rows.map(
                    row =>
                        getConversation(
                            row.id
                        )
                );


            res.json({
                conversations
            });


        } catch (error) {

            console.error(
                "Conversation list error:",
                error
            );


            res.status(500).json({

                error:
                    "Could not load conversations"

            });

        }

    }
);


/* =========================
   SEARCH CONVERSATIONS
========================= */

app.get(
    "/conversations/search",
    (req, res) => {

        try {

            const query =
                String(
                    req.query.q || ""
                ).trim();


            if (!query) {

                return res.json({
                    conversations: []
                });

            }


            const rows =
                db.prepare(`
                    SELECT DISTINCT
                        c.id,
                        c.title,
                        c.created_at,
                        c.updated_at,
                        c.pinned,
                        c.archived
                    FROM conversations c

                    LEFT JOIN messages m
                        ON m.conversation_id = c.id

                    WHERE
                        c.title LIKE ?
                        OR m.text LIKE ?

                    ORDER BY
                        c.pinned DESC,
                        c.updated_at DESC
                `).all(
                    `%${query}%`,
                    `%${query}%`
                );


            res.json({

                conversations:
                    rows.map(
                        row =>
                            getConversation(
                                row.id
                            )
                    )

            });


        } catch (error) {

            console.error(
                "Conversation search error:",
                error
            );


            res.status(500).json({

                error:
                    "Could not search conversations"

            });

        }

    }
);


/* =========================
   GET CONVERSATION
========================= */

app.get(
    "/conversations/:id",
    (req, res) => {

        try {

            const conversation =
                getConversation(
                    req.params.id
                );


            if (!conversation) {

                return res.status(404).json({

                    error:
                        "Conversation not found"

                });

            }


            res.json({
                conversation
            });


        } catch (error) {

            console.error(
                "Get conversation error:",
                error
            );


            res.status(500).json({

                error:
                    "Could not load conversation"

            });

        }

    }
);


/* =========================
   RENAME CONVERSATION
========================= */

app.patch(
    "/conversations/:id",
    (req, res) => {

        try {

            const title =
                String(
                    req.body.title || ""
                ).trim();


            if (!title) {

                return res.status(400).json({

                    error:
                        "Title is required"

                });

            }


            const result =
                db.prepare(`
                    UPDATE conversations
                    SET
                        title = ?,
                        updated_at = ?
                    WHERE id = ?
                `).run(
                    title,
                    Date.now(),
                    req.params.id
                );


            if (
                result.changes === 0
            ) {

                return res.status(404).json({

                    error:
                        "Conversation not found"

                });

            }


            res.json({

                success:
                    true,

                conversation:
                    getConversation(
                        req.params.id
                    )

            });


        } catch (error) {

            console.error(
                "Rename conversation error:",
                error
            );


            res.status(500).json({

                error:
                    "Could not rename conversation"

            });

        }

    }
);


/* =========================
   PIN CONVERSATION
========================= */

app.patch(
    "/conversations/:id/pin",
    (req, res) => {

        try {

            const conversation =
                getConversation(
                    req.params.id
                );


            if (!conversation) {

                return res.status(404).json({

                    error:
                        "Conversation not found"

                });

            }


            const pinned =
                req.body.pinned === undefined
                    ? !conversation.pinned
                    : Boolean(
                        req.body.pinned
                    );


            db.prepare(`
                UPDATE conversations
                SET
                    pinned = ?,
                    updated_at = ?
                WHERE id = ?
            `).run(
                pinned ? 1 : 0,
                Date.now(),
                req.params.id
            );


            res.json({

                success:
                    true,

                conversation:
                    getConversation(
                        req.params.id
                    )

            });


        } catch (error) {

            console.error(
                "Pin error:",
                error
            );


            res.status(500).json({

                error:
                    "Could not update pin"

            });

        }

    }
);


/* =========================
   ARCHIVE CONVERSATION
========================= */

app.patch(
    "/conversations/:id/archive",
    (req, res) => {

        try {

            const conversation =
                getConversation(
                    req.params.id
                );


            if (!conversation) {

                return res.status(404).json({

                    error:
                        "Conversation not found"

                });

            }


            const archived =
                req.body.archived === undefined
                    ? !conversation.archived
                    : Boolean(
                        req.body.archived
                    );


            db.prepare(`
                UPDATE conversations
                SET
                    archived = ?,
                    updated_at = ?
                WHERE id = ?
            `).run(
                archived ? 1 : 0,
                Date.now(),
                req.params.id
            );


            res.json({

                success:
                    true,

                conversation:
                    getConversation(
                        req.params.id
                    )

            });


        } catch (error) {

            console.error(
                "Archive error:",
                error
            );


            res.status(500).json({

                error:
                    "Could not update archive"

            });

        }

    }
);


/* =========================
   DELETE CONVERSATION
========================= */

app.delete(
    "/conversations/:id",
    (req, res) => {

        try {

            const result =
                db.prepare(`
                    DELETE FROM conversations
                    WHERE id = ?
                `).run(
                    req.params.id
                );


            if (
                result.changes === 0
            ) {

                return res.status(404).json({

                    error:
                        "Conversation not found"

                });

            }


            res.json({

                success:
                    true

            });


        } catch (error) {

            console.error(
                "Delete conversation error:",
                error
            );


            res.status(500).json({

                error:
                    "Could not delete conversation"

            });

        }

    }
);


/* =========================
   MEMORY API
========================= */

app.get(
    "/memory",
    (req, res) => {

        try {

            res.json({

                memories:
                    getMemories()

            });


        } catch (error) {

            console.error(
                "Memory load error:",
                error
            );


            res.status(500).json({

                error:
                    "Could not load memories"

            });

        }

    }
);


app.post(
    "/memory",
    (req, res) => {

        try {

            const key =
                String(
                    req.body.key || ""
                ).trim();


            const value =
                String(
                    req.body.value || ""
                ).trim();


            if (
                !key ||
                !value
            ) {

                return res.status(400).json({

                    error:
                        "key and value are required"

                });

            }


            saveMemory(
                key,
                value
            );


            res.json({

                success:
                    true,

                key,

                value

            });


        } catch (error) {

            console.error(
                "Memory save error:",
                error
            );


            res.status(500).json({

                error:
                    "Could not save memory"

            });

        }

    }
);


/* =========================
   MEMORY DELETE
========================= */

app.delete(
    "/memory/:key",
    (req, res) => {

        try {

            const key =
                String(
                    req.params.key || ""
                ).trim();


            if (!key) {

                return res.status(400).json({

                    error:
                        "Memory key is required"

                });

            }


            const result =
                deleteMemory(key);


            res.json({

                success:
                    true,

                deleted:
                    result.changes > 0,

                key

            });


        } catch (error) {

            console.error(
                "Memory delete error:",
                error
            );


            res.status(500).json({

                error:
                    "Could not delete memory"

            });

        }

    }
);


/* =========================
   CHAT
========================= */

app.post(
    "/chat",
    async (req, res) => {

        let conversationId = "";


        try {

            const message =
                String(
                    req.body.message || ""
                ).trim();


            conversationId =
                String(
                    req.body.conversationId || ""
                ).trim();


            if (!message) {

                return res.status(400).json({

                    error:
                        "Message is required"

                });

            }


            /*
               Automatic memory detection.
            */

            const detectedMemory =
                detectMemoryRequest(
                    message
                );


            if (detectedMemory) {

                saveMemory(
                    detectedMemory.key,
                    detectedMemory.value
                );

            }


            /*
               AI availability.
            */

            if (!ai) {

                return res.status(503).json({

                    error:
                        "Kivo AI is not configured yet"

                });

            }


            /*
               Create conversation.
            */

            if (!conversationId) {

                conversationId =
                    crypto.randomUUID();


                const title =
                    message.length > 50
                        ? message.substring(0, 50) + "..."
                        : message;


                createConversation(
                    conversationId,
                    title
                );

            }


            /*
               Verify conversation.
            */

            const existing =
                getConversation(
                    conversationId
                );


            if (!existing) {

                return res.status(404).json({

                    error:
                        "Conversation not found"

                });

            }


            /*
               Save user message.
            */

            addMessage(
                conversationId,
                "user",
                message
            );


            /*
               Deterministic name response.
            */

            const normalized =
                message
                    .toLowerCase()
                    .replace(
                        /[?؟!।]/g,
                        ""
                    )
                    .trim();


            const nameMemory =
                getMemory(
                    "user_name"
                );


            if (
                nameMemory &&
                (
                    normalized ===
                        "আমার নাম কী" ||

                    normalized ===
                        "আমার নাম কি" ||

                    normalized ===
                        "what is my name" ||

                    normalized ===
                        "whats my name"
                )
            ) {

                const reply =
                    `আপনার নাম ${nameMemory.value}।`;


                addMessage(
                    conversationId,
                    "model",
                    reply
                );


                const finalConversation =
                    getConversation(
                        conversationId
                    );


                return res.json({

                    conversationId,

                    reply,

                    history:
                        finalConversation.messages

                });

            }


            /*
               Load history.
            */

            const databaseMessages =
                getMessages(
                    conversationId
                );


            const contents =
                databaseMessages
                    .slice(-MAX_MESSAGES)
                    .map(
                        item => ({

                            role:
                                item.role === "model"
                                    ? "model"
                                    : "user",

                            parts: [

                                {
                                    text:
                                        item.text
                                }

                            ]

                        })
                    );


            /*
               Generate response.
            */

            const response =
                await ai.models.generateContent({

                    model:
                        MODEL,

                    contents,

                    config: {

                        systemInstruction:
                            buildSystemInstruction()

                    }

                });


            const reply =
                response.text ||
                "Sorry, I could not generate a response.";


            /*
               Save AI response.
            */

            addMessage(
                conversationId,
                "model",
                reply
            );


            const finalConversation =
                getConversation(
                    conversationId
                );


            res.json({

                conversationId,

                reply,

                history:
                    finalConversation.messages

            });


        } catch (error) {

            console.error(
                "Kivo AI Error:",
                error
            );


            if (
                error &&
                error.status === 429
            ) {

                return res.status(429).json({

                    error:
                        "Kivo AI quota is temporarily exhausted. Please try again later."

                });

            }


            res.status(500).json({

                error:
                    "AI response failed"

            });

        }

    }
);


/* =========================
   START
========================= */

app.listen(
    PORT,
    () => {

        console.log(
            `Kivo Backend running on port ${PORT}`
        );

        console.log(
            "SQLite database: ./kivo.db"
        );

        console.log(
            `Gemini model: ${MODEL}`
        );

    }
);