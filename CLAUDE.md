# Agent Battle Command Center - AI Context

> This file provides context for AI assistants working on this codebase.

## Project Overview

A command center for orchestrating AI coding agents with cost-optimized tiered routing:
- **Sonnet** - Task decomposition for standard complexity (<8)
- **Opus** - Complex decomposition (8+) and code review
- **Haiku** - Medium+ task execution (4+) and fixes
- **Ollama** - Simple task execution (<4), free local model

## Architecture

```
UI (React:5173) → API (Express:3001) → Agents (FastAPI:8000) → Ollama/Claude
                         ↓
                   PostgreSQL:5432
```

## Cost-Optimized Task Flow

```
Task Arrives → calculateComplexity()
       │
       ├─ DECOMPOSITION (if needed)
       │   ├─ <8  → Sonnet (~$0.005)
       │   └─ ≥8  → Opus (~$0.04)
       │
       ├─ EXECUTION
       │   ├─ <4  → Ollama (free)
       │   └─ ≥4  → Haiku (~$0.001)
       │
       ├─ CODE REVIEW (batch, all tasks)
       │   └─ Opus (~$0.02/task)
       │
       └─ FIX CYCLE (if review fails)
           ├─ 1st attempt → Haiku
           ├─ 2nd attempt → Sonnet
           └─ 3rd failure → Human escalation
```

## Key Concepts

### Task Decomposition
CTO agent breaks complex tasks into atomic subtasks:
- ONE function per subtask
- ONE file per subtask
- Each has a validation command (e.g., `python -c "from tasks.calc import add; print(add(2,3))"`)

### Complexity Routing (taskRouter.ts)
Tasks are scored 1-10 and routed:
- Simple (< 4) → Coder (Ollama) - free, fast
- Medium+ (≥ 4) → QA (Haiku) - quality, ~$0.001
- Failed tasks use fix cycle (Haiku → Sonnet → Human)

### Code Review System
New `CodeReview` model tracks Opus reviews:
- Quality score (0-10)
- Findings with severity (critical/high/medium/low)
- Complexity comparison (initial vs Opus assessment)
- Token usage and cost tracking
- Fix attempt history

### Execution Logging
Every tool call is captured to database with:
- Action, input, observation
- Timing (milliseconds)
- Token usage (input/output)
- Model used
- Loop detection flag

## Package Structure

```
packages/
├── api/src/
│   ├── routes/
│   │   ├── tasks.ts          # Task CRUD
│   │   ├── agents.ts         # Agent management
│   │   ├── queue.ts          # Smart routing
│   │   ├── code-reviews.ts   # Code review API (NEW)
│   │   ├── execution-logs.ts # Execution history
│   │   └── task-planning.ts  # Decomposition API
│   └── services/
│       ├── taskQueue.ts      # Task lifecycle
│       ├── taskRouter.ts     # Tiered complexity routing (UPDATED)
│       └── trainingDataService.ts
├── agents/src/
│   ├── agents/
│   │   ├── coder.py      # Coder agent (Ollama)
│   │   ├── qa.py         # QA agent (Haiku)
│   │   └── cto.py        # CTO agent (Opus/Sonnet)
│   ├── tools/
│   │   ├── file_ops.py   # File read/write/edit
│   │   └── cto_tools.py  # create_subtask, review_code, etc.
│   └── monitoring/
│       ├── action_history.py   # Loop detection
│       └── execution_logger.py # Tool call logging
├── ui/src/components/
│   ├── layout/CommandCenter.tsx  # Main layout
│   ├── main-view/
│   │   ├── TaskQueue.tsx      # Large task card grid (UPDATED)
│   │   ├── ActiveMissions.tsx # Compact running tasks strip (UPDATED)
│   │   └── TaskDetail.tsx     # Task detail + code review display (UPDATED)
│   └── micromanager/
│       └── MicromanagerView.tsx  # Real-time execution logs (UPDATED)
└── workspace/
    ├── tasks/           # Active task workspace
    ├── tests/           # Active tests
    ├── tasks_archive/   # Archived task files (for training data)
    └── tests_archive/   # Archived test files
```

## Database Models (Prisma)

Key models in `packages/api/prisma/schema.prisma`:
- **Task** - Tasks with status, type, parent/child relationships
- **Agent** - Agent instances with config (model, etc.)
- **ExecutionLog** - Tool call history + token tracking
- **CodeReview** - Opus code review results (NEW)
- **TrainingDataset** - Claude vs local comparison data

### CodeReview Schema
```prisma
model CodeReview {
  id                 String   @id
  taskId             String
  reviewerId         String?
  reviewerModel      String?
  initialComplexity  Float    // Router's score
  opusComplexity     Float?   // Opus assessment
  findings           Json     // [{severity, category, description, suggestion}]
  summary            String?
  codeQualityScore   Float?   // 0-10
  status             String   // pending/approved/needs_fixes/rejected
  fixAttempts        Int
  fixedByAgentId     String?
  fixedByModel       String?
  inputTokens        Int?
  outputTokens       Int?
  totalCost          Decimal?
}
```

## Current Priorities

1. **Fix SOFT_FAILURE Issue** - Agents report failure but code is correct
2. **Implement Opus Code Review** - Batch review after task completion
3. **Training Data Collection** - Use archives for model improvement

## Patterns to Follow

### Creating New API Routes
```typescript
// packages/api/src/routes/example.ts
import { Router } from 'express';
import { asyncHandler } from '../types/index.js';
import { prisma } from '../db/client.js';

export const exampleRouter = Router();

exampleRouter.get('/', asyncHandler(async (req, res) => {
  const data = await prisma.task.findMany();
  res.json(data);
}));
```

### Adding Agent Tools
```python
# packages/agents/src/tools/example.py
from crewai_tools import tool

@tool("Tool Name")
def my_tool(param: str) -> str:
    """Tool description for agent."""
    return json.dumps({"success": True})
```

## Common Commands

```bash
# Start everything
docker compose up

# Run test suite (10 tasks)
node scripts/quick-run.js -y

# Reset stuck agents
curl -X POST http://localhost:3001/api/agents/reset-all

# Check task routing
curl http://localhost:3001/api/queue/TASK_ID/route

# View execution logs
curl http://localhost:3001/api/execution-logs/task/TASK_ID

# Get code review for task
curl http://localhost:3001/api/code-reviews/task/TASK_ID

# Get review stats
curl http://localhost:3001/api/code-reviews/stats
```

## Archive Structure

```
scripts/
└── json_logs_archive/
    └── YYYYMMDD_HHMMSS/    # Timestamped run archives
        ├── DIAGNOSTIC_REPORT.json/md
        ├── logs-*.json     # Per-task execution logs
        ├── execution-results.json
        └── training-data.json

workspace/
├── tasks_archive/    # Old task Python files
└── tests_archive/    # Old test files
```

## Documentation

- [API Reference](docs/API.md) - All endpoints
- [Development Guide](docs/DEVELOPMENT.md) - Testing, debugging
- [Changelog](CHANGELOG.md) - Version history
