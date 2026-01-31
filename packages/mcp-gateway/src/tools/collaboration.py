"""Collaboration tools for MCP."""

import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class CollaborationTools:
    """Provides collaboration tools via MCP.

    Tools:
    - mcp_log_step(task_id, step) - Log execution step + broadcast
    - mcp_subscribe_logs(task_id) - Subscribe to real-time log updates
    """

    def __init__(self, redis_adapter, log_provider):
        """Initialize collaboration tools.

        Args:
            redis_adapter: Redis cache adapter
            log_provider: Log resource provider
        """
        self.redis = redis_adapter
        self.log_provider = log_provider

    async def log_step(self, task_id: str, step: dict) -> dict:
        """Log execution step and broadcast.

        Args:
            task_id: Task ID
            step: Log step data (action, input, observation, etc.)

        Returns:
            Result dictionary
        """
        logger.info(f"[{task_id}] Logging execution step: {step.get('action', 'unknown')}")

        try:
            # Add timestamp if not present
            if "timestamp" not in step:
                step["timestamp"] = datetime.utcnow().isoformat()

            # Add task_id if not present
            if "task_id" not in step:
                step["task_id"] = task_id

            # Append log via log provider (handles Redis storage + broadcast)
            result = await self.log_provider.append_log(task_id, step)

            return {
                "success": True,
                "task_id": task_id,
                "step": step,
                **result,
            }

        except Exception as e:
            logger.error(f"[{task_id}] Error logging step: {e}")
            return {"success": False, "error": str(e)}

    async def subscribe_logs(self, task_id: str) -> dict:
        """Subscribe to real-time log updates.

        Args:
            task_id: Task ID

        Returns:
            Subscription info
        """
        logger.info(f"[{task_id}] Subscribing to log stream")

        try:
            # Get subscription channel info
            channel = f"logs:{task_id}:stream"

            # Return subscription details (actual subscription handled by client)
            return {
                "success": True,
                "task_id": task_id,
                "channel": channel,
                "message": f"Subscribe to Redis channel '{channel}' for real-time logs",
            }

        except Exception as e:
            logger.error(f"[{task_id}] Error subscribing to logs: {e}")
            return {"success": False, "error": str(e)}

    async def get_collaborating_agents(self, task_id: str) -> dict:
        """Get list of agents currently working on a task.

        Args:
            task_id: Task ID

        Returns:
            List of agent IDs
        """
        logger.info(f"[{task_id}] Getting collaborating agents")

        try:
            # Get active agents from Redis
            collab_key = f"collaboration:{task_id}"
            agent_ids = await self.redis.smembers(collab_key)

            return {
                "success": True,
                "task_id": task_id,
                "agents": list(agent_ids) if agent_ids else [],
            }

        except Exception as e:
            logger.error(f"[{task_id}] Error getting collaborating agents: {e}")
            return {"success": False, "error": str(e)}

    async def join_collaboration(self, task_id: str, agent_id: str) -> dict:
        """Join task collaboration.

        Args:
            task_id: Task ID
            agent_id: Agent ID joining the collaboration

        Returns:
            Result dictionary
        """
        logger.info(f"[{task_id}] Agent {agent_id} joining collaboration")

        try:
            # Add agent to collaboration set
            collab_key = f"collaboration:{task_id}"
            await self.redis.sadd(collab_key, agent_id)
            await self.redis.expire(collab_key, 3600)  # 1 hour TTL

            # Broadcast join event
            await self.redis.publish(
                f"collaboration:{task_id}:events",
                json.dumps({
                    "event": "agent_joined",
                    "agent_id": agent_id,
                    "task_id": task_id,
                    "timestamp": datetime.utcnow().isoformat(),
                }),
            )

            logger.info(f"[{task_id}] Agent {agent_id} joined collaboration")
            return {"success": True, "task_id": task_id, "agent_id": agent_id}

        except Exception as e:
            logger.error(f"[{task_id}] Error joining collaboration: {e}")
            return {"success": False, "error": str(e)}

    async def leave_collaboration(self, task_id: str, agent_id: str) -> dict:
        """Leave task collaboration.

        Args:
            task_id: Task ID
            agent_id: Agent ID leaving the collaboration

        Returns:
            Result dictionary
        """
        logger.info(f"[{task_id}] Agent {agent_id} leaving collaboration")

        try:
            # Remove agent from collaboration set
            collab_key = f"collaboration:{task_id}"
            await self.redis.srem(collab_key, agent_id)

            # Broadcast leave event
            await self.redis.publish(
                f"collaboration:{task_id}:events",
                json.dumps({
                    "event": "agent_left",
                    "agent_id": agent_id,
                    "task_id": task_id,
                    "timestamp": datetime.utcnow().isoformat(),
                }),
            )

            logger.info(f"[{task_id}] Agent {agent_id} left collaboration")
            return {"success": True, "task_id": task_id, "agent_id": agent_id}

        except Exception as e:
            logger.error(f"[{task_id}] Error leaving collaboration: {e}")
            return {"success": False, "error": str(e)}
