# MCP Gateway

MCP (Model Context Protocol) Gateway for real-time agent-to-agent collaboration in the Agent Battle Command Center.

## Overview

The MCP Gateway acts as a shared state layer between agents, enabling real-time collaboration by:

- **Caching hot state** in Redis for fast access
- **Syncing with PostgreSQL** as the source of truth
- **Broadcasting updates** via Redis pub/sub
- **Providing file locking** to prevent conflicts
- **Streaming execution logs** for real-time monitoring

## Architecture

```
Python Agents → MCP Gateway → Redis (cache) → PostgreSQL (truth)
                    ↓
                 MCP Server
                    ↓
         Resources & Tools (stdio/HTTP)
```

## MCP Resources

Multi-tenant namespaced resources:

- `tasks://{taskId}/state` - Task status, assignedAgentId, complexity
- `tasks://{taskId}/files` - List of files touched by task
- `workspace://{taskId}/{path}` - File content (task-scoped)
- `logs://{taskId}` - Execution log stream (real-time)
- `agents://{agentId}/status` - Agent health and current task
- `collaboration://{taskId}` - Which agents are co-working

## MCP Tools

- `mcp_file_read(task_id, path)` - Read file via MCP with task scoping
- `mcp_file_write(task_id, path, content)` - Write with conflict detection
- `mcp_claim_file(task_id, path)` - Acquire file lock (60s timeout)
- `mcp_release_file(task_id, path)` - Release file lock
- `mcp_log_step(task_id, step)` - Log execution step + broadcast
- `mcp_subscribe_logs(task_id)` - Subscribe to real-time log updates

## State Sync Strategy

**Three-tier Architecture:**

1. **PostgreSQL** - Source of truth for all state
2. **Redis** - Hot cache for active tasks (1 hour TTL)
3. **MCP Gateway** - Coordination layer

**Sync Flow:**

```
Agent Tool Call → MCP Gateway → Redis (cache + broadcast)
                                   ↓
                     PostgreSQL (batched every 5s)
```

## Configuration

Environment variables (see `src/config.py`):

```bash
# PostgreSQL
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=agent_battle
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0

# Sync intervals
SYNC_FROM_POSTGRES_INTERVAL=1.0  # Pull changes every 1s
SYNC_TO_POSTGRES_INTERVAL=5.0    # Batch write every 5s

# Cache TTLs
TASK_CACHE_TTL=3600              # 1 hour
FILE_LOCK_TIMEOUT=60             # 60 seconds

# MCP
MCP_TRANSPORT=stdio              # stdio or http
```

## Usage

### Running the MCP Server

```bash
# Via Docker
docker compose up mcp-gateway

# Via Python
cd packages/mcp-gateway
python -m src.server
```

### Health Check

```bash
docker exec abcc-mcp-gateway python -m src.server --health-check
# Output: {"status": "healthy", "version": "1.0.0"}
```

### Connecting from Agents

```python
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

server_params = StdioServerParameters(
    command="docker",
    args=["exec", "abcc-mcp-gateway", "python", "-m", "src.server"],
    env={"AGENT_ID": "coder-01"}
)

async with stdio_client(server_params) as (read, write):
    async with ClientSession(read, write) as session:
        # Use MCP tools
        result = await session.call_tool("mcp_file_read", {
            "task_id": "task-123",
            "path": "calc.py"
        })
```

## Development

### Setup

```bash
cd packages/mcp-gateway
pip install -r requirements.txt
pip install -e .
```

### Running Tests

```bash
pytest tests/
```

### Code Formatting

```bash
black src/
ruff src/
```

## Monitoring

### Redis Cache Status

```bash
# Check cache hit rate
docker exec abcc-redis redis-cli INFO stats | grep keyspace_hits
docker exec abcc-redis redis-cli INFO stats | grep keyspace_misses

# View active tasks in cache
docker exec abcc-redis redis-cli KEYS "task:*"

# View file locks
docker exec abcc-redis redis-cli KEYS "lock:file:*"
```

### Sync Lag

```python
from src.adapters.postgres import postgres_adapter

lag_ms = await postgres_adapter.get_sync_lag()
print(f"Sync lag: {lag_ms}ms")
```

## Troubleshooting

### High Sync Lag

If sync lag exceeds 1 second:

1. Check PostgreSQL load: `docker stats abcc-postgres`
2. Increase sync interval: `SYNC_FROM_POSTGRES_INTERVAL=2.0`
3. Reduce batch size: `SYNC_BATCH_SIZE=50`

### Redis Memory Issues

If Redis memory usage exceeds 80%:

1. Reduce cache TTL: `TASK_CACHE_TTL=1800` (30 minutes)
2. Enable Redis eviction: Configure `maxmemory-policy` in `docker-compose.yml`

### File Lock Deadlocks

If file locks are stuck:

1. Check lock owners: `docker exec abcc-redis redis-cli KEYS "lock:file:*"`
2. Force release: `docker exec abcc-redis redis-cli DEL "lock:file:calc.py"`
3. Locks auto-expire after 60 seconds

## Migration from HTTP Tools

Agents can use MCP tools alongside HTTP tools during gradual rollout:

```python
# config.py
USE_MCP = os.getenv("USE_MCP", "false").lower() == "true"

# agents/coder.py
if USE_MCP:
    from src.tools.mcp_file_ops import CODER_MCP_TOOLS
    tools = CODER_MCP_TOOLS
else:
    from src.tools.file_ops import CODER_TOOLS
    tools = CODER_TOOLS
```

Set `USE_MCP=true` to enable MCP tools for testing.

## License

MIT
