"""File resource provider for MCP."""

import json
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)


class FileResourceProvider:
    """Provides workspace file resources via MCP.

    Resources:
    - workspace://{taskId}/{path} - File content (task-scoped)
    """

    def __init__(self, redis_adapter):
        """Initialize file resource provider.

        Args:
            redis_adapter: Redis cache adapter
        """
        self.redis = redis_adapter
        self.workspace_root = Path("/app/workspace")

    async def read_resource(self, uri: str) -> str:
        """Read file resource by URI.

        Args:
            uri: Resource URI (e.g., workspace://task-123/calc.py)

        Returns:
            File content
        """
        logger.info(f"Reading file resource: {uri}")

        # Parse URI: workspace://{taskId}/{path}
        if not uri.startswith("workspace://"):
            raise ValueError(f"Invalid workspace URI: {uri}")

        parts = uri[12:].split("/", 1)
        if len(parts) < 2:
            raise ValueError(f"Invalid workspace URI format: {uri}")

        task_id = parts[0]
        file_path = parts[1]

        # Validate task exists
        task_data = await self.redis.get_task(task_id)
        if not task_data:
            raise ValueError(f"Task not found: {task_id}")

        # Construct full file path (task-scoped)
        full_path = self.workspace_root / "tasks" / file_path

        # Security check: prevent path traversal
        if not str(full_path.resolve()).startswith(str(self.workspace_root.resolve())):
            raise ValueError(f"Path traversal attempt detected: {file_path}")

        # Check if file exists
        if not full_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        # Read file content
        try:
            with open(full_path, "r", encoding="utf-8") as f:
                content = f.read()
            logger.info(f"Read {len(content)} bytes from {file_path}")
            return content
        except Exception as e:
            logger.error(f"Error reading file {file_path}: {e}")
            raise

    async def write_file(self, task_id: str, path: str, content: str) -> dict:
        """Write file content.

        Args:
            task_id: Task ID
            path: File path (relative to workspace)
            content: File content

        Returns:
            Result dictionary
        """
        logger.info(f"Writing file for task {task_id}: {path}")

        # Construct full file path
        full_path = self.workspace_root / "tasks" / path

        # Security check
        if not str(full_path.resolve()).startswith(str(self.workspace_root.resolve())):
            raise ValueError(f"Path traversal attempt detected: {path}")

        # Create parent directories
        full_path.parent.mkdir(parents=True, exist_ok=True)

        # Write file
        try:
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(content)

            # Track file in Redis
            await self.redis.add_task_file(task_id, path)

            logger.info(f"Wrote {len(content)} bytes to {path}")
            return {"success": True, "path": path, "bytes": len(content)}

        except Exception as e:
            logger.error(f"Error writing file {path}: {e}")
            raise
