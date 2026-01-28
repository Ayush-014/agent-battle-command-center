# Agent Battle Command Center

A "Starcraft-style" command center for orchestrating multiple AI coding agents with intelligent task routing and human-in-the-loop oversight.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         UI (React)                              │
│                      localhost:5173                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTP/WebSocket
┌─────────────────────────▼───────────────────────────────────────┐
│                      API (Node.js/Express)                      │
│                      localhost:3001                             │
└──────────┬──────────────────────────────────┬───────────────────┘
           │                                  │
┌──────────▼──────────┐           ┌──────────▼───────────────────┐
│   PostgreSQL        │           │   Agents (Python/CrewAI)     │
│   localhost:5432    │           │   localhost:8000             │
└─────────────────────┘           └──────────┬───────────────────┘
                                             │
                                  ┌──────────▼───────────────────┐
                                  │   Ollama (Local LLM)         │
                                  │   localhost:11434            │
                                  └──────────────────────────────┘
```

## Quick Start

```bash
# 1. Create .env file
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

# 2. Start all services
docker compose up

# 3. Open UI
open http://localhost:5173
```

## Agent Hierarchy

| Agent | Model | Role |
|-------|-------|------|
| **CTO** | Claude Opus | Task decomposition, strategic oversight |
| **QA** | Claude Haiku | Testing, code review |
| **Coders** | Ollama (local) | Code execution |

## Key Features

- **Intelligent Task Routing** - Complexity-based assignment to appropriate agents
- **Task Decomposition** - CTO breaks complex tasks into atomic subtasks
- **Execution Logging** - Full tool call history with timing
- **Training Data Collection** - Captures Claude executions for fine-tuning
- **Loop Detection** - Prevents agents from repeating same actions
- **Human Escalation** - Automatic timeout and human review requests

## Documentation

- [API Reference](docs/API.md)
- [Development Guide](docs/DEVELOPMENT.md)
- [Changelog](CHANGELOG.md)
- [AI Assistant Context](CLAUDE.md)

## Project Structure

```
packages/
├── api/          # Node.js backend (Express + Prisma)
├── agents/       # Python agent service (FastAPI + CrewAI)
├── shared/       # Shared TypeScript types
└── ui/           # React frontend (Vite + Tailwind)
```

## License

MIT
