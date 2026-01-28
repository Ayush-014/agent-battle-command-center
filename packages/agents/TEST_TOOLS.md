# Testing Agent Tool Usage

## The Problem

Agents weren't using their tools (file_write, file_read, shell_run, etc.) during task execution. They would just respond with text instead of actually doing the work.

## What We Fixed

1. **Switched from `Ollama` to `ChatOllama`**
   - `langchain_community.llms.Ollama` doesn't support function/tool calling
   - `langchain_community.chat_models.ChatOllama` has proper tool support

2. **Added verbose logging**
   - Now you can see exactly what tools the agent is trying to use
   - Shows LLM model, available tools, and execution steps

## How to Test

### 1. Rebuild the agents container

```bash
docker compose build --no-cache agents
docker compose up agents -d
```

### 2. Run the test script

```bash
docker compose exec agents python test_tools.py
```

This will:
- Create an agent with file tools
- Ask it to write a "hello.txt" file
- Verify the file was actually created
- Show all tool calls in the output

### 3. Expected Output

You should see:
```
✅ Ollama is available
📦 Creating agent with tools...
   Agent role: Senior Software Developer
   Tools available: ['file_read', 'file_write', 'file_edit', 'file_list', 'shell_run', ...]
📝 Creating task: Write hello.txt file
🚀 Starting agent execution...
... [tool calls here] ...
✅ File exists at /app/workspace/hello.txt
   Content: Hello World from ABCC!
```

### 4. What to Look For

**GOOD** - Agent uses tools:
```
> Entering new CrewAgentExecutor chain...
I need to use the file_write tool to create the file.

Action: file_write
Action Input: {"path": "hello.txt", "content": "Hello World from ABCC!"}
Successfully wrote to hello.txt
```

**BAD** - Agent just talks:
```
> Entering new CrewAgentExecutor chain...
I will create a file called hello.txt with the content...
Final Answer: File created successfully.
```

## Model Recommendations

Current models you have:
- `qwen3:8b` (500MB) - **Try this first**
- `codellama:13b-instruct` (7.4GB) - Instruction-tuned, may not work well with tools
- `llama3.1:8b` (4.9GB) - Limited tool support

**Better option**: Pull `qwen2.5-coder:7b` or `qwen2.5-coder:14b`
```bash
docker compose exec ollama ollama pull qwen2.5-coder:7b
```

Then update `.env`:
```
OLLAMA_MODEL=qwen2.5-coder:7b
```

## Troubleshooting

### Agent still not using tools?

1. Check the logs: `docker compose logs -f agents`
2. Look for lines like "Action:" and "Action Input:"
3. If you see "Final Answer:" without any actions, the model isn't using tools

### Try different model

Some models are better at function calling than others. If one doesn't work, try another:
- qwen2.5-coder series (best for coding)
- llama3.1 (decent general purpose)
- mistral (good instruction following)

### Increase max_iter

In `packages/agents/src/agents/coder.py`, increase `max_iter=5` to `max_iter=10` to give the agent more chances to use tools.
