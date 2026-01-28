# Changelog

All notable changes to Agent Battle Command Center.

---

## [Phase A] - 2026-01-27

### Task Decomposition System

**Major Milestone:** CTO agent can now decompose complex tasks into atomic subtasks that local agents execute with 100% code correctness.

#### Added
- `create_subtask()` CTO tool for creating atomic subtasks
- `complete_decomposition()` CTO tool for marking decomposition complete
- Task Planning API endpoints:
  - `POST /api/task-planning/:taskId/decompose`
  - `GET /api/task-planning/:taskId/subtasks`
  - `POST /api/task-planning/:taskId/execute-subtasks`
- Database fields: `acceptanceCriteria`, `contextNotes`, `validationCommand`
- Test scripts: `test-atomic-decomposition.js`, `execute-atomic-subtasks.js`

#### Model Hierarchy Configured
| Agent | Model | Cost |
|-------|-------|------|
| Coders | Ollama (qwen2.5-coder:7b) | Free |
| QA | Claude Haiku | ~$0.001/task |
| CTO | Claude Opus | ~$0.04/task |

#### Test Results
- CTO decomposed "Create calculator module" into 4 atomic subtasks
- Each subtask had validation command (e.g., `python -c "from tasks.calculator import add; print(add(2,3))"`)
- Local agents produced 100% correct code for all subtasks
- Known issue: Status reports SOFT_FAILURE but code is correct (output parsing issue)

---

## [Phase 4 Steps 0-3] - 2026-01-26

### Step 0: Fix Stuck Tasks (12 min)
- Fixed `/api/agents/reset-all` to mark ALL assigned/in_progress tasks as failed
- Previously only marked tasks with errors

### Step 1: Execution Logging (2.5 hrs)
- Created `ExecutionLog` database model
- Created `ExecutionLogger` class for real-time tool call capture
- API endpoints: `/api/execution-logs/task/:id`, etc.
- Precise timing (9-35ms per action)
- Post-processing now accurately populates `files_created`, `commands_executed`

### Step 2: CTO Agent (1.5 hrs)
- Created cto-01 "CTO-Sentinel" agent
- 6 strategic tools: `review_code`, `query_logs`, `assign_task`, `escalate_task`, `get_task_info`, `list_agents`
- Intelligent task routing based on complexity scoring (1-10)
- Routing rules:
  - Complexity > 7 → CTO
  - Failed > 1x → CTO
  - Task type "review" → CTO
  - Task type "test" → QA
  - Simple tasks (< 4) → Coder

### Step 3: Training Data Collection (2 hrs)
- Created `TrainingDataset` database model
- Auto-captures all Claude/local executions
- Complexity-based quality scoring
- JSONL export for fine-tuning
- API: `/api/training-data`, `/api/training-data/stats`, `/api/training-data/export`

---

## [Phase 3A] - 2026-01-25

### Loop Detection
- Created `ActionHistory` singleton tracker
- Integrated into all 7 tools
- Detection rules:
  - Exact duplicate in last 3 actions → BLOCK
  - Similar (>80%) in last 5 → WARN
  - Same tool 5+ times → BLOCK
- Clear error messages for agent to understand

---

## [Phase 1.5] - 2026-01-25

### Agent Quality & Reliability

#### Verification System
- Added verification requirements to agent backstories
- Golden Rule: "Trust what you SEE in output, not what you HOPE happened"
- Forbidden behaviors list

#### Extended Output Schema
- Status: SUCCESS, SOFT_FAILURE, HARD_FAILURE, UNCERTAIN
- Confidence: 0.0-1.0
- Failure tracking: `what_was_attempted`, `what_succeeded`, `what_failed`
- `actual_output`, `failure_reason`, `suggestions`

#### Test Output Parser
- Created `validators/test_validator.py`
- Parses pytest, unittest, generic formats
- Correctly identifies "Ran 0 tests" as failure

#### Post-Processing
- Extracts file operations from CrewAI logs
- Auto-generates clean summaries
- Tracks success/failure per action

---

## [Phase 2] - 2026-01-24

### Agent Intelligence

- Workspace file access via tools
- Enhanced agent backstories with multi-step instructions
- Tool usage examples in prompts
- Increased iteration limits (Coder: 25, QA: 50)
- Context cleanup between tasks (memory=False, cache=False)
- Optimized model selection: **qwen2.5-coder:7b** recommended

---

## [Phase 1] - 2026-01-23

### Core Functionality

#### UI
- Chat interface with streaming
- Task creation modal
- Task queue with filters
- Pending/completed toggle

#### Task Execution
- Execute button on task cards
- Auto-assignment to agents
- Real-time status updates via WebSocket
- File read/write/edit tools
- Shell command execution

#### Infrastructure
- 5 containers: UI, API, Agents, PostgreSQL, Ollama
- Ollama auto-pulls model on startup
- Database migrations with Prisma
- WebSocket events for real-time updates

---

## Bug Fixes (Cumulative)

- ResourceBar overlay blocking UI clicks
- Ollama healthcheck command
- Task execution missing description
- Agent tool calling parameter mismatch
- Delete task restrictions
- Agent loop prevention
- Context cleanup between tasks
- Workspace organization (tasks/, tests/ folders)
