"""FastAPI HTTP server for MCP Gateway tools.

This provides HTTP endpoints for agents to call MCP tools without using
the MCP protocol directly (which requires stdio transport).
"""

import asyncio
import logging
from typing import Dict, List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from src.adapters.redis import RedisAdapter
from src.adapters.postgres import PostgresAdapter
from src.resources.tasks import TaskResourceProvider
from src.resources.files import FileResourceProvider
from src.resources.logs import LogResourceProvider
from src.tools.file_ops import FileOperationTools, FileLockError
from src.tools.collaboration import CollaborationTools

logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(
    title="MCP Gateway API",
    description="HTTP API for MCP Gateway tools and resources",
    version="1.0.0",
)

# Global adapters and tools (initialized on startup)
redis_adapter: RedisAdapter = None
postgres_adapter: PostgresAdapter = None
file_tools: FileOperationTools = None
collab_tools: CollaborationTools = None
sync_tasks: List[asyncio.Task] = []


# -------------------------------------------------------------------------
# Request/Response Models
# -------------------------------------------------------------------------


class FileReadRequest(BaseModel):
    task_id: str
    path: str


class FileWriteRequest(BaseModel):
    task_id: str
    path: str
    content: str


class ClaimFileRequest(BaseModel):
    task_id: str
    path: str
    timeout_sec: int = 60


class ReleaseFileRequest(BaseModel):
    task_id: str
    path: str


class LogStepRequest(BaseModel):
    task_id: str
    step: Dict


class SubscribeLogsRequest(BaseModel):
    task_id: str


class CollaborationRequest(BaseModel):
    task_id: str
    agent_id: str


# -------------------------------------------------------------------------
# Startup/Shutdown
# -------------------------------------------------------------------------


@app.on_event("startup")
async def startup():
    """Initialize adapters and tools on startup."""
    global redis_adapter, postgres_adapter, file_tools, collab_tools, sync_tasks

    logger.info("Initializing MCP Gateway API...")

    # Initialize adapters
    redis_adapter = RedisAdapter()
    await redis_adapter.connect()
    logger.info("Redis adapter connected")

    postgres_adapter = PostgresAdapter(redis_adapter)
    await postgres_adapter.connect()
    logger.info("PostgreSQL adapter connected")

    # Initialize resource providers
    task_provider = TaskResourceProvider(redis_adapter, postgres_adapter)
    file_provider = FileResourceProvider(redis_adapter)
    log_provider = LogResourceProvider(redis_adapter)
    logger.info("Resource providers initialized")

    # Initialize tool providers
    file_tools = FileOperationTools(redis_adapter, file_provider)
    collab_tools = CollaborationTools(redis_adapter, log_provider)
    logger.info("Tool providers initialized")

    # Start background sync tasks
    logger.info("Starting background sync tasks...")
    sync_from_task = asyncio.create_task(postgres_adapter.sync_from_postgres())
    sync_to_task = asyncio.create_task(postgres_adapter.sync_to_postgres())
    sync_tasks.extend([sync_from_task, sync_to_task])
    logger.info(f"Started {len(sync_tasks)} sync tasks")

    logger.info("MCP Gateway API started successfully")


@app.on_event("shutdown")
async def shutdown():
    """Close connections on shutdown."""
    global redis_adapter, postgres_adapter, sync_tasks

    logger.info("Shutting down MCP Gateway API...")

    # Cancel sync tasks
    for task in sync_tasks:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
    logger.info("Sync tasks cancelled")

    # Close adapters
    if postgres_adapter:
        await postgres_adapter.close()
    if redis_adapter:
        await redis_adapter.close()

    logger.info("MCP Gateway API shut down")


# -------------------------------------------------------------------------
# Health Check
# -------------------------------------------------------------------------


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": "1.0.0"}


# -------------------------------------------------------------------------
# File Operation Endpoints
# -------------------------------------------------------------------------


@app.post("/tools/file_read")
async def api_file_read(request: FileReadRequest):
    """Read file via MCP tools."""
    try:
        result = await file_tools.file_read(request.task_id, request.path)
        return result
    except Exception as e:
        logger.error(f"File read error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tools/file_write")
async def api_file_write(request: FileWriteRequest):
    """Write file via MCP tools."""
    try:
        result = await file_tools.file_write(
            request.task_id, request.path, request.content
        )
        return result
    except FileLockError as e:
        logger.warning(f"File lock error: {e}")
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        logger.error(f"File write error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tools/claim_file")
async def api_claim_file(request: ClaimFileRequest):
    """Acquire file lock via MCP tools."""
    try:
        result = await file_tools.claim_file(
            request.task_id, request.path, request.timeout_sec
        )
        if not result.get("success"):
            raise HTTPException(status_code=409, detail=result.get("error"))
        return result
    except Exception as e:
        logger.error(f"Lock claim error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tools/release_file")
async def api_release_file(request: ReleaseFileRequest):
    """Release file lock via MCP tools."""
    try:
        result = await file_tools.release_file(request.task_id, request.path)
        return result
    except Exception as e:
        logger.error(f"Lock release error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------------------------------------------------
# Collaboration Endpoints
# -------------------------------------------------------------------------


@app.post("/tools/log_step")
async def api_log_step(request: LogStepRequest):
    """Log execution step via MCP tools."""
    try:
        result = await collab_tools.log_step(request.task_id, request.step)
        return result
    except Exception as e:
        logger.error(f"Log step error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tools/subscribe_logs")
async def api_subscribe_logs(request: SubscribeLogsRequest):
    """Subscribe to real-time logs."""
    try:
        result = await collab_tools.subscribe_logs(request.task_id)
        return result
    except Exception as e:
        logger.error(f"Subscribe logs error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tools/join_collaboration")
async def api_join_collaboration(request: CollaborationRequest):
    """Join task collaboration."""
    try:
        result = await collab_tools.join_collaboration(
            request.task_id, request.agent_id
        )
        return result
    except Exception as e:
        logger.error(f"Join collaboration error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tools/leave_collaboration")
async def api_leave_collaboration(request: CollaborationRequest):
    """Leave task collaboration."""
    try:
        result = await collab_tools.leave_collaboration(
            request.task_id, request.agent_id
        )
        return result
    except Exception as e:
        logger.error(f"Leave collaboration error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------------------------------------------------
# Resource Endpoints
# -------------------------------------------------------------------------


@app.get("/resources/tasks/{task_id}/state")
async def api_get_task_state(task_id: str):
    """Get task state resource."""
    try:
        task_data = await redis_adapter.get_task(task_id)
        if not task_data:
            raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
        return task_data
    except Exception as e:
        logger.error(f"Get task state error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/resources/collaboration/{task_id}")
async def api_get_collaborating_agents(task_id: str):
    """Get collaborating agents for task."""
    try:
        result = await collab_tools.get_collaborating_agents(task_id)
        return result
    except Exception as e:
        logger.error(f"Get collaborating agents error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
