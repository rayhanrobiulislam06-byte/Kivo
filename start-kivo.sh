#!/data/data/com.termux/files/usr/bin/bash

cd /storage/emulated/0/Gemma4Chatbot || exit 1

echo "Starting Kivo..."
echo "Web UI: http://127.0.0.1:3001/web-ai/"
echo

exec python native_gemma_web.py
