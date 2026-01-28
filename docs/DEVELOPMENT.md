# Development Guide

## Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- pnpm 8+
- ANTHROPIC_API_KEY (for Claude/CTO features)

## Quick Start

```bash
# Start all services
docker compose up

# Access UI
open http://localhost:5173
```

## Environment Variables

Create `.env` in project root:

```env
ANTHROPIC_API_KEY=sk-ant-...        # Required for Claude/CTO
OLLAMA_MODEL=qwen2.5-coder:7b       # Local model (auto-pulled)
```

### Recommended Ollama Models

| Model | Use Case | VRAM |
|-------|----------|------|
| qwen2.5-coder:7b | Best for coding (RECOMMENDED) | ~6GB |
| qwen2.5-coder:14b | Higher quality, slower | ~12GB |
| llama3.1:8b | General purpose | ~6GB |

---

## Docker Commands

### Rebuild Services
```bash
docker compose build --no-cache api
docker compose build --no-cache agents
docker compose build --no-cache ui
docker compose up
```

### View Logs
```bash
docker compose logs -f api
docker compose logs -f agents
docker compose logs -f ollama
```

### Database Access
```bash
docker compose exec api npx prisma studio
```

### Reset Database
```bash
docker compose down -v  # removes volumes
docker compose up
```

### Switch Ollama Model
```bash
docker compose exec ollama ollama list
docker compose exec ollama ollama pull qwen2.5-coder:7b
# Update .env, then:
docker compose restart agents
```

---

## Testing

### Test Agent Tools
```bash
docker compose exec agents python test_tools.py
```

### Test Chat Endpoint
```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"agent_type": "coder", "messages": [{"role": "user", "content": "Hello"}], "stream": false}'
```

### Test Task Execution

1. Open UI at http://localhost:5173
2. Click "Add Task"
3. Create task: Title "Create hello.txt", Type "Code"
4. Click "Execute"
5. Watch status: pending → assigned → in_progress → completed

### Test Smart Routing
```bash
# Get routing recommendation
curl http://localhost:3001/api/queue/YOUR_TASK_ID/route

# Auto-route next task
curl -X POST http://localhost:3001/api/queue/smart-assign
```

### Test Task Decomposition
```bash
# Run decomposition test
node test-atomic-decomposition.js

# Execute subtasks
node execute-atomic-subtasks.js

# Verify generated code
docker compose exec agents cat /app/workspace/tasks/calculator.py
docker compose exec agents python -c "from tasks.calculator import add; print(add(2,3))"
```

---

## Debugging

### Check Agent Status
```bash
curl http://localhost:3001/api/agents
```

### Reset Stuck Agents
```bash
curl -X POST http://localhost:3001/api/agents/reset-all
```

### View Execution Logs
```bash
curl http://localhost:3001/api/execution-logs/task/YOUR_TASK_ID
```

### Check Training Data
```bash
curl http://localhost:3001/api/training-data/stats
```

---

## Project Structure

```
packages/
├── api/           # Node.js backend
│   ├── src/
│   │   ├── routes/       # API endpoints
│   │   ├── services/     # Business logic
│   │   └── db/           # Prisma client
│   └── prisma/           # Schema & migrations
├── agents/        # Python agent service
│   └── src/
│       ├── agents/       # Agent definitions
│       ├── tools/        # Agent tools
│       ├── monitoring/   # Logging & loop detection
│       └── validators/   # Output validators
├── ui/            # React frontend
│   └── src/
│       ├── components/   # UI components
│       └── stores/       # State management
└── shared/        # Shared TypeScript types
```

---

## Agent Types

| Agent | Model | Purpose |
|-------|-------|---------|
| coder-01, coder-02 | Ollama | Code execution |
| qa-01 | Claude Haiku | Testing & review |
| cto-01 | Claude Opus | Task decomposition, oversight |

### Change Agent Model
```bash
curl -X PATCH http://localhost:3001/api/agents/qa-01 \
  -H "Content-Type: application/json" \
  -d '{"config": {"alwaysUseClaude": true, "preferredModel": "claude-haiku-4-20250514"}}'
```

---

## Common Issues

### Agent Stuck in Loop
The system has loop detection. If agent repeats same action 3+ times, it will error and stop.

### Task Stuck in "assigned"
Use reset button in UI or:
```bash
curl -X POST http://localhost:3001/api/agents/reset-all
```

### Ollama Not Responding
```bash
docker compose restart ollama
docker compose logs -f ollama
```

### Claude API Errors
Check your ANTHROPIC_API_KEY in .env and restart:
```bash
docker compose restart agents
```
