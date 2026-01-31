"""Log resource provider for MCP."""

import json
import logging
from typing import AsyncIterator

logger = logging.getLogger(__name__)


class LogResourceProvider:
    """Provides execution log streaming via MCP.

    Resources:
    - logs://{taskId} - Execution log stream (real-time)
    - logs://{taskId}/stream - Subscribe to real-time updates
    """

    def __init__(self, redis_adapter):
        """Initialize log resource provider.

        Args:
            redis_adapter: Redis cache adapter
        """
        self.redis = redis_adapter

    async def read_resource(self, uri: str) -> str:
        """Read log resource by URI.

        Args:
            uri: Resource URI (e.g., logs://task-123)

        Returns:
            Log entries as JSON array
        """
        logger.info(f"Reading log resource: {uri}")

        # Parse URI: logs://{taskId}[/stream]
        if not uri.startswith("logs://"):
            raise ValueError(f"Invalid log URI: {uri}")

        parts = uri[7:].split("/")
        task_id = parts[0]

        if len(parts) == 1:
            # Get historical logs
            logs = await self.redis.get_logs(task_id)
            return json.dumps({"task_id": task_id, "logs": logs})

        elif len(parts) == 2 and parts[1] == "stream":
            # Return stream subscription info
            return json.dumps({
                "task_id": task_id,
                "stream": True,
                "channel": f"logs:{task_id}:stream",
            })

        else:
            raise ValueError(f"Invalid log URI format: {uri}")

    async def append_log(self, task_id: str, step: dict) -> dict:
        """Append log step and broadcast.

        Args:
            task_id: Task ID
            step: Log step data

        Returns:
            Result dictionary
        """
        logger.info(f"Appending log step for task {task_id}")

        # Store in Redis list
        log_key = f"logs:{task_id}"
        await self.redis.lpush(log_key, json.dumps(step))
        await self.redis.expire(log_key, 3600)  # 1 hour TTL

        # Broadcast to subscribers
        channel = f"logs:{task_id}:stream"
        await self.redis.publish(channel, json.dumps(step))

        logger.info(f"Log step appended and broadcast for task {task_id}")
        return {"success": True, "task_id": task_id}

    async def stream_logs(self, task_id: str) -> AsyncIterator[dict]:
        """Stream logs in real-time.

        Args:
            task_id: Task ID

        Yields:
            Log step dictionaries
        """
        logger.info(f"Streaming logs for task {task_id}")

        # Subscribe to Redis pub/sub channel
        channel = f"logs:{task_id}:stream"
        pubsub = self.redis.client.pubsub()

        try:
            await pubsub.subscribe(channel)
            logger.info(f"Subscribed to log stream: {channel}")

            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = json.loads(message["data"])
                    yield data

        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.close()
            logger.info(f"Unsubscribed from log stream: {channel}")
