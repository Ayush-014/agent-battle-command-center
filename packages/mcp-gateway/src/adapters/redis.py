"""Redis adapter for state caching and pub/sub."""

import json
import logging
from typing import Any, Optional

import redis.asyncio as redis

from src.config import settings

logger = logging.getLogger(__name__)


class RedisAdapter:
    """Redis adapter for caching and real-time notifications.

    Features:
    - Task state caching (1 hour TTL)
    - Distributed file locks (60s timeout, auto-expiry)
    - Execution log streaming (Redis Streams)
    - Pub/sub for real-time notifications
    """

    def __init__(self):
        """Initialize Redis adapter."""
        self.client: Optional[redis.Redis] = None
        self.url = settings.redis_url
        self.max_connections = settings.redis_max_connections

    async def connect(self):
        """Connect to Redis."""
        logger.info(f"Connecting to Redis: {settings.redis_host}:{settings.redis_port}")

        self.client = await redis.from_url(
            self.url,
            max_connections=self.max_connections,
            decode_responses=True,
        )

        # Test connection
        await self.client.ping()
        logger.info("Redis connection established")

    async def close(self):
        """Close Redis connection."""
        if self.client:
            await self.client.close()
            logger.info("Redis connection closed")

    # Task state caching

    async def get_task(self, task_id: str) -> Optional[dict]:
        """Get task state from Redis cache.

        Args:
            task_id: Task ID

        Returns:
            Task data dict or None if not found
        """
        key = f"task:{task_id}"
        data = await self.client.get(key)
        return json.loads(data) if data else None

    async def set_task(self, task_id: str, task_data: dict, ttl: int = None):
        """Cache task state.

        Args:
            task_id: Task ID
            task_data: Task data dictionary
            ttl: Time-to-live in seconds (default: settings.task_cache_ttl)
        """
        if ttl is None:
            ttl = settings.task_cache_ttl

        key = f"task:{task_id}"
        await self.client.setex(key, ttl, json.dumps(task_data))

    async def delete_task(self, task_id: str):
        """Delete task from cache.

        Args:
            task_id: Task ID
        """
        key = f"task:{task_id}"
        await self.client.delete(key)

    # File tracking

    async def get_task_files(self, task_id: str) -> list[str]:
        """Get list of files touched by task.

        Args:
            task_id: Task ID

        Returns:
            List of file paths
        """
        key = f"task:{task_id}:files"
        files = await self.client.smembers(key)
        return list(files) if files else []

    async def add_task_file(self, task_id: str, file_path: str):
        """Add file to task's file list.

        Args:
            task_id: Task ID
            file_path: File path
        """
        key = f"task:{task_id}:files"
        await self.client.sadd(key, file_path)
        await self.client.expire(key, settings.task_cache_ttl)

    # File locks

    async def get_lock_owner(self, file_path: str) -> Optional[str]:
        """Get current lock owner for a file.

        Args:
            file_path: File path

        Returns:
            Task ID of lock owner or None if unlocked
        """
        lock_key = f"lock:file:{file_path}"
        return await self.client.get(lock_key)

    async def set(
        self, key: str, value: str, nx: bool = False, ex: int = None
    ) -> bool:
        """Set Redis key with optional NX (not exists) and EX (expiry).

        Args:
            key: Redis key
            value: Value to set
            nx: Only set if key doesn't exist (for locks)
            ex: Expiry time in seconds

        Returns:
            True if set successfully, False otherwise
        """
        return await self.client.set(key, value, nx=nx, ex=ex)

    async def get(self, key: str) -> Optional[str]:
        """Get Redis key value.

        Args:
            key: Redis key

        Returns:
            Value or None if key doesn't exist
        """
        return await self.client.get(key)

    async def delete(self, key: str):
        """Delete Redis key.

        Args:
            key: Redis key
        """
        await self.client.delete(key)

    # Execution logs

    async def get_logs(self, task_id: str, limit: int = 100) -> list[dict]:
        """Get execution logs for a task.

        Args:
            task_id: Task ID
            limit: Maximum number of logs to return

        Returns:
            List of log entries (most recent first)
        """
        log_key = f"logs:{task_id}"
        logs = await self.client.lrange(log_key, 0, limit - 1)
        return [json.loads(log) for log in logs] if logs else []

    async def lpush(self, key: str, value: str):
        """Push value to head of Redis list.

        Args:
            key: Redis key
            value: Value to push
        """
        await self.client.lpush(key, value)

    async def expire(self, key: str, seconds: int):
        """Set expiry time for Redis key.

        Args:
            key: Redis key
            seconds: Expiry time in seconds
        """
        await self.client.expire(key, seconds)

    # Pub/sub

    async def publish(self, channel: str, message: str):
        """Publish message to Redis channel.

        Args:
            channel: Channel name
            message: Message to publish
        """
        await self.client.publish(channel, message)

    def pubsub(self):
        """Get Redis pub/sub client.

        Returns:
            Redis pub/sub client
        """
        return self.client.pubsub()

    # Collaboration

    async def smembers(self, key: str) -> set:
        """Get all members of a Redis set.

        Args:
            key: Redis key

        Returns:
            Set of members
        """
        return await self.client.smembers(key)

    async def sadd(self, key: str, *values: str):
        """Add members to a Redis set.

        Args:
            key: Redis key
            values: Values to add
        """
        await self.client.sadd(key, *values)

    async def srem(self, key: str, *values: str):
        """Remove members from a Redis set.

        Args:
            key: Redis key
            values: Values to remove
        """
        await self.client.srem(key, *values)
