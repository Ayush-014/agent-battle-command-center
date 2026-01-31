"""File operation tools for MCP."""

import json
import logging

logger = logging.getLogger(__name__)


class FileLockError(Exception):
    """Raised when file lock cannot be acquired."""

    pass


class FileOperationTools:
    """Provides file operation tools via MCP.

    Tools:
    - mcp_file_read(task_id, path) - Read file with task scoping
    - mcp_file_write(task_id, path, content) - Write with conflict detection
    - mcp_claim_file(task_id, path) - Acquire file lock (60s timeout)
    - mcp_release_file(task_id, path) - Release file lock
    """

    def __init__(self, redis_adapter, file_provider):
        """Initialize file operation tools.

        Args:
            redis_adapter: Redis cache adapter
            file_provider: File resource provider
        """
        self.redis = redis_adapter
        self.file_provider = file_provider

    async def file_read(self, task_id: str, path: str) -> dict:
        """Read file via MCP.

        Args:
            task_id: Task ID
            path: File path

        Returns:
            File content
        """
        logger.info(f"[{task_id}] Reading file: {path}")

        try:
            # Construct resource URI
            uri = f"workspace://{task_id}/{path}"

            # Read from file provider
            content = await self.file_provider.read_resource(uri)

            return {
                "success": True,
                "task_id": task_id,
                "path": path,
                "content": content,
            }

        except Exception as e:
            logger.error(f"[{task_id}] Error reading file {path}: {e}")
            return {"success": False, "error": str(e)}

    async def file_write(self, task_id: str, path: str, content: str) -> dict:
        """Write file via MCP.

        Args:
            task_id: Task ID
            path: File path
            content: File content

        Returns:
            Result dictionary
        """
        logger.info(f"[{task_id}] Writing file: {path}")

        try:
            # Check if file is locked by another task
            lock_owner = await self.redis.get_lock_owner(path)
            if lock_owner and lock_owner != task_id:
                raise FileLockError(f"File locked by task {lock_owner}")

            # Write file
            result = await self.file_provider.write_file(task_id, path, content)

            # Broadcast file update event
            await self.redis.publish(
                f"file:updates",
                json.dumps({"task_id": task_id, "path": path, "action": "write"}),
            )

            return {"success": True, "task_id": task_id, **result}

        except Exception as e:
            logger.error(f"[{task_id}] Error writing file {path}: {e}")
            return {"success": False, "error": str(e)}

    async def claim_file(self, task_id: str, path: str, timeout_sec: int = 60) -> dict:
        """Acquire file lock.

        Args:
            task_id: Task ID
            path: File path
            timeout_sec: Lock timeout in seconds (default: 60)

        Returns:
            Result dictionary
        """
        logger.info(f"[{task_id}] Claiming file lock: {path}")

        try:
            lock_key = f"lock:file:{path}"

            # Try to acquire lock using Redis SETNX (atomic)
            acquired = await self.redis.set(
                lock_key, task_id, nx=True, ex=timeout_sec  # Only set if not exists
            )

            if not acquired:
                # Lock already held
                owner = await self.redis.get(lock_key)
                raise FileLockError(f"File locked by task {owner}")

            # Broadcast lock acquisition
            await self.redis.publish(
                f"locks:{path}",
                json.dumps({"locked": True, "by": task_id, "path": path}),
            )

            logger.info(f"[{task_id}] File lock acquired: {path}")
            return {"success": True, "task_id": task_id, "path": path, "locked": True}

        except FileLockError as e:
            logger.warning(f"[{task_id}] Failed to acquire lock for {path}: {e}")
            return {"success": False, "error": str(e), "locked": False}

        except Exception as e:
            logger.error(f"[{task_id}] Error acquiring lock for {path}: {e}")
            return {"success": False, "error": str(e)}

    async def release_file(self, task_id: str, path: str) -> dict:
        """Release file lock.

        Args:
            task_id: Task ID
            path: File path

        Returns:
            Result dictionary
        """
        logger.info(f"[{task_id}] Releasing file lock: {path}")

        try:
            lock_key = f"lock:file:{path}"

            # Verify this task owns the lock
            owner = await self.redis.get(lock_key)
            if owner != task_id:
                raise FileLockError(
                    f"Cannot release lock owned by task {owner}" if owner else "Lock not held"
                )

            # Release lock
            await self.redis.delete(lock_key)

            # Broadcast lock release
            await self.redis.publish(
                f"locks:{path}",
                json.dumps({"locked": False, "by": task_id, "path": path}),
            )

            logger.info(f"[{task_id}] File lock released: {path}")
            return {"success": True, "task_id": task_id, "path": path, "locked": False}

        except Exception as e:
            logger.error(f"[{task_id}] Error releasing lock for {path}: {e}")
            return {"success": False, "error": str(e)}
