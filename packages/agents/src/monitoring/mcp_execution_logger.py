"""MCP-based execution logger for agents.

This logger sends execution steps to MCP Gateway for real-time collaboration
and log streaming.
"""

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, Optional

from src.mcp.client import MCPGatewayClient, MCPGatewayError

logger = logging.getLogger(__name__)


class MCPExecutionLogger:
    """Logs execution steps via MCP Gateway.

    Features:
    - Real-time log streaming via Redis pub/sub
    - Automatic collaboration tracking (join/leave)
    - Asynchronous logging (non-blocking)
    """

    def __init__(self, agent_id: str, task_id: str):
        """Initialize MCP execution logger.

        Args:
            agent_id: Agent ID (e.g., \"coder-01\", \"qa-01\")
            task_id: Task ID
        """
        self.agent_id = agent_id
        self.task_id = task_id
        self.client = MCPGatewayClient(agent_id=agent_id, task_id=task_id)
        self.step_count = 0

        logger.info(
            f"[{agent_id}] MCP execution logger initialized for task {task_id}"
        )

    async def join_collaboration(self):
        """Join task collaboration (notify other agents)."""
        try:
            await self.client.connect()
            result = await self.client.join_collaboration(self.task_id)
            logger.info(
                f"[{self.agent_id}] Joined collaboration for task {self.task_id}"
            )
            return result
        except MCPGatewayError as e:
            logger.error(f"[{self.agent_id}] Failed to join collaboration: {e}")
            return None

    async def leave_collaboration(self):
        """Leave task collaboration (notify other agents)."""
        try:
            result = await self.client.leave_collaboration(self.task_id)
            await self.client.close()
            logger.info(
                f"[{self.agent_id}] Left collaboration for task {self.task_id}"
            )
            return result
        except MCPGatewayError as e:
            logger.error(f"[{self.agent_id}] Failed to leave collaboration: {e}")
            return None

    async def log_step_async(
        self,
        action: str,
        action_input: Dict[str, Any],
        observation: str,
        step: Optional[int] = None,
    ) -> Optional[Dict]:
        """Log execution step asynchronously.

        Args:
            action: Action name (e.g., \"file_write\", \"shell_command\")
            action_input: Action input parameters
            observation: Action observation/result
            step: Step number (auto-incremented if not provided)

        Returns:
            Result dictionary or None if failed
        """
        if step is None:
            self.step_count += 1
            step = self.step_count

        log_data = {
            "step": step,
            "action": action,
            "action_input": action_input,
            "observation": observation,
            "timestamp": datetime.utcnow().isoformat(),
            "agent_id": self.agent_id,
        }

        try:
            result = await self.client.log_step(log_data, self.task_id)
            logger.debug(
                f"[{self.agent_id}] Logged step {step} via MCP: {action}"
            )
            return result
        except MCPGatewayError as e:
            logger.error(f"[{self.agent_id}] Failed to log step via MCP: {e}")
            return None

    def log_step(
        self,
        action: str,
        action_input: Dict[str, Any],
        observation: str,
        step: Optional[int] = None,
    ) -> Optional[Dict]:
        """Log execution step (synchronous wrapper).

        Args:
            action: Action name (e.g., \"file_write\", \"shell_command\")
            action_input: Action input parameters
            observation: Action observation/result
            step: Step number (auto-incremented if not provided)

        Returns:
            Result dictionary or None if failed
        """
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If loop is already running, schedule in background
                future = asyncio.ensure_future(
                    self.log_step_async(action, action_input, observation, step)
                )
                return asyncio.run_coroutine_threadsafe(future, loop).result(
                    timeout=10
                )
            else:
                return loop.run_until_complete(
                    self.log_step_async(action, action_input, observation, step)
                )
        except Exception as e:
            logger.error(f"[{self.agent_id}] Error logging step: {e}")
            return None

    async def subscribe_to_logs(self) -> Optional[Dict]:
        """Subscribe to real-time log updates for this task.

        Returns:
            Subscription info or None if failed
        """
        try:
            result = await self.client.subscribe_logs(self.task_id)
            logger.info(
                f"[{self.agent_id}] Subscribed to logs for task {self.task_id}"
            )
            return result
        except MCPGatewayError as e:
            logger.error(f"[{self.agent_id}] Failed to subscribe to logs: {e}")
            return None

    async def get_collaborating_agents(self) -> list[str]:
        """Get list of agents currently working on this task.

        Returns:
            List of agent IDs
        """
        try:
            agents = await self.client.get_collaborating_agents(self.task_id)
            logger.debug(
                f"[{self.agent_id}] Collaborating agents: {agents}"
            )
            return agents
        except MCPGatewayError as e:
            logger.error(
                f"[{self.agent_id}] Failed to get collaborating agents: {e}"
            )
            return []

    def __enter__(self):
        """Context manager entry (join collaboration)."""
        loop = asyncio.get_event_loop()
        if loop.is_running():
            future = asyncio.ensure_future(self.join_collaboration())
            asyncio.run_coroutine_threadsafe(future, loop).result(timeout=10)
        else:
            loop.run_until_complete(self.join_collaboration())
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit (leave collaboration)."""
        loop = asyncio.get_event_loop()
        if loop.is_running():
            future = asyncio.ensure_future(self.leave_collaboration())
            asyncio.run_coroutine_threadsafe(future, loop).result(timeout=10)
        else:
            loop.run_until_complete(self.leave_collaboration())
