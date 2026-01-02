#!/bin/bash
cd "$(dirname "$0")"

# Kill any existing processes on ports 8000 or 8080
lsof -t -i:8000 | xargs kill -9 2>/dev/null
lsof -t -i:8080 | xargs kill -9 2>/dev/null

echo "Starting Local Inference Server (llama.cpp)..."
../llama.cpp/build/bin/llama-server \
    -m ../models/phi3-auditor-q4.gguf \
    --port 8080 \
    -c 2048 \
    -ngl 99 \
    --host 127.0.0.1 > llama_server.log 2>&1 &

LLAMA_PID=$!
echo "Llama server PID: $LLAMA_PID"

echo "Waiting for model to load..."
# Simple wait loop to check if port 8080 is open
for i in {1..30}; do
    if lsof -i :8080 >/dev/null; then
        echo "Llama server is UP!"
        break
    fi
    echo "."
    sleep 1
done

echo "Starting Backend..."
# Run backend
../backend/venv/bin/python3 main.py

# Cleanup on exit
kill $LLAMA_PID
