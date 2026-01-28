#!/bin/bash

# Start ollama server in the background
ollama serve &

# Wait for ollama to be ready
echo "Waiting for Ollama to start..."
until ollama list >/dev/null 2>&1; do
  sleep 2
done
echo "Ollama is ready"

# Pull the model if not already present
MODEL=${OLLAMA_MODEL:-llama3.1:8b}
if ollama list | grep -q "$MODEL"; then
  echo "Model $MODEL already available"
else
  echo "Pulling model: $MODEL"
  ollama pull "$MODEL"
  echo "Model $MODEL pulled successfully"
fi

# Keep the container running
wait
