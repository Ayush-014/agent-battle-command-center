# API Reference

## Base URLs

| Service | URL | Description |
|---------|-----|-------------|
| API | `http://localhost:3001` | Node.js backend |
| Agents | `http://localhost:8000` | Python agent service |
| UI | `http://localhost:5173` | React frontend |

---

## Tasks API

### List Tasks
```
GET /api/tasks
```

**Query Parameters:**
- `status` - Filter by status (pending, assigned, in_progress, completed, failed)
- `requiredAgent` - Filter by agent type (coder, qa, cto)
- `assignedAgentId` - Filter by assigned agent

**Response:** Array of tasks with assigned agent details

### Get Task
```
GET /api/tasks/:id
```

**Response:** Task with execution history, file locks, and subtasks

### Create Task
```
POST /api/tasks
```

**Body:**
```json
{
  "title": "string (required, max 200)",
  "description": "string",
  "taskType": "code | test | review | debug | refactor",
  "requiredAgent": "coder | qa | cto",
  "priority": "1-10 (default 5)",
  "maxIterations": "1-10 (default 3)",
  "humanTimeoutMinutes": "1-1440 (default 30)",
  "parentTaskId": "uuid (for subtasks)",
  "acceptanceCriteria": "string",
  "contextNotes": "string",
  "validationCommand": "string"
}
```

### Update Task
```
PATCH /api/tasks/:id
```

### Delete Task
```
DELETE /api/tasks/:id
```
Note: Cannot delete active tasks (assigned, in_progress, needs_human)

### Retry Failed Task
```
POST /api/tasks/:id/retry
```

### Abort Task
```
POST /api/tasks/:id/abort
```

### Complete Task (for scripts)
```
POST /api/tasks/:id/complete
```

**Body:**
```json
{
  "result": "any",
  "success": "boolean",
  "error": "string | null"
}
```

### Submit Human Input
```
POST /api/tasks/:id/human
```

**Body:**
```json
{
  "input": "string",
  "action": "approve | reject | modify",
  "modifiedContent": "string (optional)"
}
```

---

## Agents API

### List Agents
```
GET /api/agents
```

### Get Agent
```
GET /api/agents/:id
```

### Update Agent Config
```
PATCH /api/agents/:id
```

**Body:**
```json
{
  "config": {
    "preferredModel": "string",
    "alwaysUseClaude": "boolean",
    "maxContextTokens": "number"
  }
}
```

### Reset All Agents
```
POST /api/agents/reset-all
```
Marks all agents as idle and fails stuck tasks

---

## Queue API

### Get Pending Tasks
```
GET /api/queue
```

### Assign Task to Agent
```
POST /api/queue/assign
```

**Body:**
```json
{
  "taskId": "uuid",
  "agentId": "string"
}
```

### Auto-Assign Next Task
```
POST /api/queue/auto-assign
```

### Smart Assign (Complexity-Based)
```
POST /api/queue/smart-assign
```

Routes task based on complexity scoring algorithm

### Get Routing Recommendation
```
GET /api/queue/:taskId/route
```

**Response:**
```json
{
  "agentId": "coder-01",
  "agentName": "Coder-01",
  "reason": "Simple task (complexity: 2.5/10)",
  "confidence": 0.8,
  "fallbackAgentId": "coder-02"
}
```

---

## Task Planning API

### Trigger CTO Decomposition
```
POST /api/task-planning/:taskId/decompose
```

Assigns task to CTO agent for decomposition into atomic subtasks

### Get Subtasks
```
GET /api/task-planning/:taskId/subtasks
```

### Execute All Subtasks
```
POST /api/task-planning/:taskId/execute-subtasks
```

---

## Execution Logs API

### Store Log Entry
```
POST /api/execution-logs
```

**Body:**
```json
{
  "taskId": "uuid",
  "agentId": "string",
  "step": "number",
  "thought": "string",
  "action": "string",
  "actionInput": "object",
  "observation": "string",
  "durationMs": "number",
  "isLoop": "boolean",
  "errorTrace": "string"
}
```

### Get Task Execution History
```
GET /api/execution-logs/task/:taskId
```

### Get Agent Recent Logs
```
GET /api/execution-logs/agent/:agentId
```

### Get Loop Detection Logs
```
GET /api/execution-logs/task/:taskId/loops
```

### Delete Task Logs
```
DELETE /api/execution-logs/task/:taskId
```

---

## Training Data API

### List Training Data
```
GET /api/training-data
```

**Query Parameters:**
- `taskType` - Filter by task type
- `complexity` - Filter by complexity score
- `isGoodExample` - Filter good training examples

### Get Statistics
```
GET /api/training-data/stats
```

### Export as JSONL
```
GET /api/training-data/export
```

### Mark for Human Review
```
POST /api/training-data/:id/review
```

### Update Metadata
```
PATCH /api/training-data/:id
```

---

## Chat API

### List Conversations
```
GET /api/chat/conversations
```

### Create Conversation
```
POST /api/chat/conversations
```

### Get Conversation with Messages
```
GET /api/chat/conversations/:id
```

### Delete Conversation
```
DELETE /api/chat/conversations/:id
```

### Send Message (Triggers Streaming)
```
POST /api/chat/conversations/:id/messages
```

---

## Python Agents API (localhost:8000)

### Execute Task
```
POST /execute
```

**Body:**
```json
{
  "task_id": "uuid",
  "agent_id": "string",
  "task_description": "string",
  "expected_output": "string",
  "use_claude": "boolean (default false)"
}
```

### Execute Single Step
```
POST /execute/step
```

### Approve Step
```
POST /execute/approve
```

### Reject Step
```
POST /execute/reject
```

### Chat with Agent (Streaming SSE)
```
POST /chat
```

### Health Check
```
GET /health
```

---

## WebSocket Events

Connect to `ws://localhost:3001` with Socket.io client.

### Task Events
- `task_created` - New task created
- `task_updated` - Task status/data changed
- `task_deleted` - Task removed

### Agent Events
- `agent_status_changed` - Agent status update

### Chat Events
- `chat_message_chunk` - Streaming response chunk
- `chat_message_complete` - Response finished
- `chat_error` - Error occurred
