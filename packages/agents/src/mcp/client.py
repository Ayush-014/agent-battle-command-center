"""MCP Gateway client for Python agents.

This client provides HTTP-based communication with the MCP Gateway service
for real-time agent-to-agent collaboration.
"""

import asyncio
import json
import logging
from typing import Any, Dict, Optional

import aiohttp

from src.config import settings

logger = logging.getLogger(__name__)


class MCPGatewayError(Exception):
    """Raised when MCP Gateway operations fail."""

    pass


class MCPGatewayClient:
    """Client for communicating with MCP Gateway service.

    The MCP Gateway provides:
    - Task state synchronization (Redis cache)
    - Distributed file locks
    - Execution log streaming (Redis pub/sub)
    - Agent collaboration tracking

    Connection:
    - HTTP transport to MCP Gateway service (mcp-gateway:8001)
    - Timeout: 30 seconds (configurable)
    """

    def __init__(self, agent_id: str, task_id: Optional[str] = None):
        """Initialize MCP Gateway client.

        Args:
            agent_id: Agent ID (e.g., "coder-01", "qa-01")
            task_id: Current task ID (optional, can be set later)
        """
        self.agent_id = agent_id
        self.task_id = task_id
        self.gateway_url = settings.MCP_GATEWAY_URL
        self.timeout = settings.MCP_GATEWAY_TIMEOUT
        self.session: Optional[aiohttp.ClientSession] = None

        logger.info(f"[{agent_id}] MCP Gateway client initialized (URL: {self.gateway_url})")

    async def connect(self):
        """Connect to MCP Gateway (create HTTP session)."""
        if self.session is None:
            timeout = aiohttp.ClientTimeout(total=self.timeout)
            self.session = aiohttp.ClientSession(timeout=timeout)
            logger.info(f"[{self.agent_id}] MCP Gateway HTTP session created")

    async def close(self):
        """Close MCP Gateway connection."""
        if self.session:
            await self.session.close()
            self.session = None
            logger.info(f"[{self.agent_id}] MCP Gateway HTTP session closed")

    async def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make HTTP request to MCP Gateway.

        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint (e.g., "/tools/file_read")
            **kwargs: Additional request arguments (json, params, etc.)

        Returns:
            Response JSON

        Raises:
            MCPGatewayError: If request fails
        """
        if self.session is None:
            await self.connect()

        url = f"{self.gateway_url}{endpoint}"

        try:
            async with self.session.request(method, url, **kwargs) as response:
                if response.status >= 400:
                    error_text = await response.text()
                    raise MCPGatewayError(
                        f"MCP Gateway request failed: {response.status} {error_text}"
                    )

                return await response.json()

        except aiohttp.ClientError as e:
            logger.error(f"[{self.agent_id}] MCP Gateway request error: {e}")
            raise MCPGatewayError(f"MCP Gateway connection error: {e}") from e

    # -------------------------------------------------------------------------
    # File Operations
    # -------------------------------------------------------------------------

    async def file_read(self, path: str, task_id: Optional[str] = None) -> str:
        """Read file via MCP Gateway.

        Args:
            path: File path (relative to workspace/tasks/)
            task_id: Task ID (uses self.task_id if not provided)

        Returns:
            File content

        Raises:
            MCPGatewayError: If file read fails
        """
        task_id = task_id or self.task_id
        if not task_id:
            raise MCPGatewayError("task_id required for file operations")

        logger.info(f"[{self.agent_id}] Reading file via MCP: {path}")

        response = await self._request(
            "POST",
            "/tools/file_read",
            json={"task_id": task_id, "path": path},
        )

        if not response.get("success"):
            raise MCPGatewayError(f"File read failed: {response.get('error')}")

        return response["content"]

    async def file_write(
        self, path: str, content: str, task_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Write file via MCP Gateway.

        Args:
            path: File path (relative to workspace/tasks/)
            content: File content
            task_id: Task ID (uses self.task_id if not provided)

        Returns:
            Result dictionary

        Raises:
            MCPGatewayError: If file write fails or file is locked
        """
        task_id = task_id or self.task_id
        if not task_id:
            raise MCPGatewayError("task_id required for file operations")

        logger.info(f"[{self.agent_id}] Writing file via MCP: {path}")

        response = await self._request(
            "POST",
            "/tools/file_write",
            json={"task_id": task_id, "path": path, "content": content},
        )

        if not response.get("success"):
            raise MCPGatewayError(f"File write failed: {response.get('error')}")

        return response

    async def claim_file(
        self, path: str, timeout_sec: int = 60, task_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Acquire distributed file lock via MCP Gateway.

        Args:
            path: File path
            timeout_sec: Lock timeout in seconds (default: 60)
            task_id: Task ID (uses self.task_id if not provided)

        Returns:
            Result dictionary with lock status

        Raises:
            MCPGatewayError: If lock acquisition fails (e.g., already locked)
        """
        task_id = task_id or self.task_id
        if not task_id:
            raise MCPGatewayError("task_id required for file operations")

        logger.info(f"[{self.agent_id}] Claiming file lock via MCP: {path}")

        response = await self._request(
            "POST",
            "/tools/claim_file",
            json={"task_id": task_id, "path": path, "timeout_sec": timeout_sec},
        )

        if not response.get("success"):
            raise MCPGatewayError(f"Lock acquisition failed: {response.get('error')}")

        return response

    async def release_file(
        self, path: str, task_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Release distributed file lock via MCP Gateway.

        Args:
            path: File path
            task_id: Task ID (uses self.task_id if not provided)

        Returns:
            Result dictionary

        Raises:
            MCPGatewayError: If lock release fails
        """
        task_id = task_id or self.task_id
        if not task_id:
            raise MCPGatewayError("task_id required for file operations")

        logger.info(f"[{self.agent_id}] Releasing file lock via MCP: {path}")

        response = await self._request(
            "POST",
            "/tools/release_file",
            json={"task_id": task_id, "path": path},
        )

        if not response.get("success"):
            raise MCPGatewayError(f"Lock release failed: {response.get('error')}")

        return response

    # -------------------------------------------------------------------------
    # Collaboration & Logging
    # -------------------------------------------------------------------------

    async def log_step(
        self, step: Dict[str, Any], task_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Log execution step via MCP Gateway.

        Args:
            step: Log step data (action, input, observation, etc.)
            task_id: Task ID (uses self.task_id if not provided)

        Returns:
            Result dictionary

        Raises:
            MCPGatewayError: If logging fails
        """
        task_id = task_id or self.task_id
        if not task_id:
            raise MCPGatewayError("task_id required for logging")

        logger.debug(f"[{self.agent_id}] Logging step via MCP: {step.get('action')}")

        response = await self._request(
            "POST",
            "/tools/log_step",
            json={"task_id": task_id, "step": step},
        )

        if not response.get("success"):
            raise MCPGatewayError(f"Log step failed: {response.get('error')}")

        return response

    async def subscribe_logs(self, task_id: Optional[str] = None) -> Dict[str, Any]:
        """Subscribe to real-time log updates via MCP Gateway.

        Args:
            task_id: Task ID (uses self.task_id if not provided)

        Returns:
            Subscription info (channel name for Redis pub/sub)

        Raises:
            MCPGatewayError: If subscription fails
        """
        task_id = task_id or self.task_id
        if not task_id:
            raise MCPGatewayError("task_id required for log subscription")

        logger.info(f"[{self.agent_id}] Subscribing to logs via MCP: {task_id}")

        response = await self._request(
            "POST",
            "/tools/subscribe_logs",
            json={"task_id": task_id},
        )

        if not response.get("success"):
            raise MCPGatewayError(f"Log subscription failed: {response.get('error')}")

        return response

    async def join_collaboration(self, task_id: Optional[str] = None) -> Dict[str, Any]:
        """Join task collaboration (add agent to collaboration set).

        Args:
            task_id: Task ID (uses self.task_id if not provided)

        Returns:
            Result dictionary

        Raises:
            MCPGatewayError: If join fails
        """
        task_id = task_id or self.task_id
        if not task_id:
            raise MCPGatewayError("task_id required for collaboration")

        logger.info(f"[{self.agent_id}] Joining collaboration for task {task_id}")

        response = await self._request(
            "POST",
            "/tools/join_collaboration",
            json={"task_id": task_id, "agent_id": self.agent_id},
        )

        if not response.get("success"):
            raise MCPGatewayError(f"Join collaboration failed: {response.get('error')}")

        return response

    async def leave_collaboration(
        self, task_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Leave task collaboration (remove agent from collaboration set).

        Args:
            task_id: Task ID (uses self.task_id if not provided)

        Returns:
            Result dictionary

        Raises:
            MCPGatewayError: If leave fails
        """
        task_id = task_id or self.task_id
        if not task_id:
            raise MCPGatewayError("task_id required for collaboration")

        logger.info(f"[{self.agent_id}] Leaving collaboration for task {task_id}")

        response = await self._request(
            "POST",
            "/tools/leave_collaboration",
            json={"task_id": task_id, "agent_id": self.agent_id},
        )

        if not response.get("success"):
            raise MCPGatewayError(f"Leave collaboration failed: {response.get('error')}")

        return response

    # -------------------------------------------------------------------------
    # Resources
    # -------------------------------------------------------------------------

    async def get_task_state(self, task_id: Optional[str] = None) -> Dict[str, Any]:
        """Get task state from MCP Gateway.

        Args:
            task_id: Task ID (uses self.task_id if not provided)

        Returns:
            Task state dictionary

        Raises:
            MCPGatewayError: If task retrieval fails
        """
        task_id = task_id or self.task_id
        if not task_id:
            raise MCPGatewayError("task_id required")

        logger.debug(f"[{self.agent_id}] Getting task state via MCP: {task_id}")

        response = await self._request(
            "GET",
            f"/resources/tasks/{task_id}/state",
        )

        return response

    async def get_collaborating_agents(
        self, task_id: Optional[str] = None
    ) -> list[str]:
        """Get list of agents currently working on task.

        Args:
            task_id: Task ID (uses self.task_id if not provided)

        Returns:
            List of agent IDs

        Raises:
            MCPGatewayError: If retrieval fails
        """
        task_id = task_id or self.task_id
        if not task_id:
            raise MCPGatewayError("task_id required")

        logger.debug(
            f"[{self.agent_id}] Getting collaborating agents via MCP: {task_id}"
        )

        response = await self._request(
            "GET",
            f"/resources/collaboration/{task_id}",
        )

        return response.get("agents", [])

    # -------------------------------------------------------------------------
    # Context Manager Support
    # -------------------------------------------------------------------------

    async def __aenter__(self):
        """Async context manager entry."""
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()
