# Kivo

Kivo is a ChatGPT-style on-device AI web app powered by Gemma 4 E2B.

## Architecture

- UI: HTML + CSS + JavaScript
- AI: Gemma 4 E2B
- Runtime: LiteRT-LM
- Local server: Python
- Database: SQLite (`kivo.db`)
- Server port: `3001`
- AI runs locally on the device

## Requirements

- Android + Termux
- Python
- LiteRT-LM 0.17.1
- Gemma 4 E2B LiteRT-LM model

## Model

The model is kept outside the Git repository because it is approximately 2.5 GB.

Expected model path:

```text
/storage/emulated/0/KivoModels/gemma-4-E2B/gemma-4-E2B-it.litertlm
```

## Start Kivo

From the project directory:

```bash
bash start-kivo.sh
```

Then open:

```text
http://127.0.0.1:3001/web-ai/
```

## Database

Kivo stores conversations in:

```text
kivo.db
```

The database must not be deleted or replaced during updates.

## GitHub Pages

The GitHub repository can host the Kivo web UI, but GitHub Pages cannot run the local Python server or Gemma model.

For on-device AI, the Python server must run locally on the device.

## Project Structure

```text
Gemma4Chatbot/
├── web-ai/
│   ├── index.html
│   ├── app.js
│   └── style.css
├── index.html
├── app.js
├── style.css
├── native_gemma_web.py
├── start-kivo.sh
├── kivo.db
└── android/
```

## Important

Do not delete:

- `kivo.db`
- Gemma 4 E2B model
- working backups

The AI model is intentionally excluded from Git because of its size.
