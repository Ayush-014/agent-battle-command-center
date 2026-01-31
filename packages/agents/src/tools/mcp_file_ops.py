"""MCP-based file operation tools for CrewAI agents.

These tools use the MCP Gateway for file operations with distributed locking
and real-time collaboration features.
"""

import asyncio
import logging
from typing import Optional

from crewai_tools import tool

from src.mcp.client import MCPGatewayClient, MCPGatewayError

logger = logging.getLogger(__name__)

# Global MCP client instance (shared across tools)
_mcp_client: Optional[MCPGatewayClient] = None


def get_mcp_client(agent_id: str, task_id: str) -> MCPGatewayClient:
    """Get or create MCP Gateway client.

    Args:
        agent_id: Agent ID
        task_id: Task ID

    Returns:
        MCP Gateway client instance
    """
    global _mcp_client

    if _mcp_client is None or _mcp_client.task_id != task_id:
        _mcp_client = MCPGatewayClient(agent_id=agent_id, task_id=task_id)
        logger.info(f"[{agent_id}] Created MCP Gateway client for task {task_id}")

    return _mcp_client


@tool("mcp_file_read")
def mcp_file_read(path: str, agent_id: str, task_id: str) -> str:
    """Read file via MCP Gateway.

    Uses distributed caching and real-time synchronization via MCP Gateway.

    Args:
        path (str): File path relative to workspace/tasks/
        agent_id (str): Agent ID (e.g., \"coder-01\")
        task_id (str): Task ID

    Returns:
        str: File content

    Example:
        content = mcp_file_read(\"calculator.py\", \"coder-01\", \"task-123\")
    """
    try:
        client = get_mcp_client(agent_id, task_id)

        # Run async operation in sync context
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If loop is already running, create a new task
            future = asyncio.ensure_future(client.file_read(path, task_id))
            content = asyncio.run_coroutine_threadsafe(future, loop).result(timeout=30)
        else:
            content = loop.run_until_complete(client.file_read(path, task_id))

        logger.info(f"[{agent_id}] Read file via MCP: {path} ({len(content)} bytes)")
        return content

    except MCPGatewayError as e:
        error_msg = f"MCP file read failed: {e}"
        logger.error(f"[{agent_id}] {error_msg}")
        return f"ERROR: {error_msg}"
    except Exception as e:
        error_msg = f"Unexpected error reading file via MCP: {e}"
        logger.error(f"[{agent_id}] {error_msg}")
        return f"ERROR: {error_msg}"


@tool("mcp_file_write")
def mcp_file_write(path: str, content: str, agent_id: str, task_id: str) -> str:
    """Write file via MCP Gateway.

    Uses distributed file locking to prevent conflicts when multiple agents
    work on the same task.

    Args:
        path (str): File path relative to workspace/tasks/
        content (str): File content to write
        agent_id (str): Agent ID (e.g., \"coder-01\")
        task_id (str): Task ID

    Returns:
        str: Success message or error

    Example:
        result = mcp_file_write(\"calculator.py\", \"def add(a, b):\\n    return a + b\", \"coder-01\", \"task-123\")
    """
    try:
        client = get_mcp_client(agent_id, task_id)

        # Run async operation in sync context
        loop = asyncio.get_event_loop()
        if loop.is_running():
            future = asyncio.ensure_future(client.file_write(path, content, task_id))
            result = asyncio.run_coroutine_threadsafe(future, loop).result(timeout=30)
        else:
            result = loop.run_until_complete(client.file_write(path, content, task_id))

        logger.info(
            f"[{agent_id}] Wrote file via MCP: {path} ({result.get('bytes', 0)} bytes)"
        )
        return f"File written successfully: {path} ({result.get('bytes', 0)} bytes)"

    except MCPGatewayError as e:
        error_msg = f"MCP file write failed: {e}"
        logger.error(f"[{agent_id}] {error_msg}")
        return f"ERROR: {error_msg}"
    except Exception as e:
        error_msg = f"Unexpected error writing file via MCP: {e}"
        logger.error(f"[{agent_id}] {error_msg}")
        return f"ERROR: {error_msg}"


@tool("mcp_file_edit")
def mcp_file_edit(
    path: str, old_content: str, new_content: str, agent_id: str, task_id: str
) -> str:
    """Edit file by replacing content via MCP Gateway.

    Uses distributed file locking and provides atomic read-modify-write operations.

    Args:
        path (str): File path relative to workspace/tasks/
        old_content (str): Content to replace
        new_content (str): New content
        agent_id (str): Agent ID (e.g., \"coder-01\")
        task_id (str): Task ID

    Returns:
        str: Success message or error

    Example:
        result = mcp_file_edit(\"calc.py\", \"return a+b\", \"return a + b  # Add numbers\", \"coder-01\", \"task-123\")
    """
    try:
        client = get_mcp_client(agent_id, task_id)

        # Read current file content
        loop = asyncio.get_event_loop()
        if loop.is_running():
            future = asyncio.ensure_future(client.file_read(path, task_id))
            current_content = asyncio.run_coroutine_threadsafe(future, loop).result(
                timeout=30
            )
        else:
            current_content = loop.run_until_complete(client.file_read(path, task_id))

        # Replace content
        if old_content not in current_content:
            error_msg = f"Old content not found in file {path}"
            logger.error(f"[{agent_id}] {error_msg}")
            return f"ERROR: {error_msg}"

        updated_content = current_content.replace(old_content, new_content, 1)

        # Write updated content
        if loop.is_running():
            future = asyncio.ensure_future(
                client.file_write(path, updated_content, task_id)
            )
            result = asyncio.run_coroutine_threadsafe(future, loop).result(timeout=30)
        else:
            result = loop.run_until_complete(
                client.file_write(path, updated_content, task_id)
            )

        logger.info(f"[{agent_id}] Edited file via MCP: {path}")
        return f"File edited successfully: {path} ({result.get('bytes', 0)} bytes)"

    except MCPGatewayError as e:
        error_msg = f"MCP file edit failed: {e}"
        logger.error(f"[{agent_id}] {error_msg}")
        return f"ERROR: {error_msg}"
    except Exception as e:
        error_msg = f"Unexpected error editing file via MCP: {e}"
        logger.error(f"[{agent_id}] {error_msg}")
        return f"ERROR: {error_msg}"


# Tool collections for different agent types
MCP_CODER_TOOLS = [
    mcp_file_read,
    mcp_file_write,
    mcp_file_edit,
]

MCP_QA_TOOLS = [
    mcp_file_read,
    mcp_file_write,
    mcp_file_edit,
]
