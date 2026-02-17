#!/bin/bash

# Start ollama server in the background
ollama serve &

# Wait for ollama to be ready
echo "Waiting for Ollama to start..."
until ollama list >/dev/null 2>&1; do
  sleep 2
done
echo "Ollama is ready"

# Pull/create the model if not already present
MODEL=${OLLAMA_MODEL:-qwen2.5-coder:7b}
if ollama list | grep -q "$MODEL"; then
  echo "Model $MODEL already available"
else
  # Check if this is a custom model (contains :32k suffix)
  if echo "$MODEL" | grep -q ":32k"; then
    BASE_MODEL=$(echo "$MODEL" | sed 's/:32k/:7b/')
    echo "Custom 32K model requested: $MODEL (base: $BASE_MODEL)"

    # Ensure base model exists
    if ! ollama list | grep -q "$BASE_MODEL"; then
      echo "Pulling base model: $BASE_MODEL"
      ollama pull "$BASE_MODEL"
    fi

    # Create 32K model from Modelfile
    echo "Creating 32K context model..."
    cat > /tmp/Modelfile << 'MODELEOF'
FROM qwen2.5-coder:7b

PARAMETER num_ctx 16384
PARAMETER temperature 0
PARAMETER num_predict 4096
PARAMETER top_p 0.9
PARAMETER repeat_penalty 1.1

SYSTEM You are CodeX-7, an elite autonomous coding unit. With 16K context capacity, you can see multiple files, full stack traces, and complete schemas in a single mission. DIRECTIVES: 1) Read ALL provided context before writing code 2) Understand cross-file dependencies 3) One write, one verify, mission complete 4) Never leave syntax errors or TODOs.
MODELEOF

    ollama create "$MODEL" -f /tmp/Modelfile
    echo "Model $MODEL created successfully"
  else
    echo "Pulling model: $MODEL"
    ollama pull "$MODEL"
    echo "Model $MODEL pulled successfully"
  fi
fi

# Keep the container running
wait
