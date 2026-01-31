"""Task resource provider for MCP."""

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)


class TaskResourceProvider:
    """Provides task-scoped resources via MCP.

    Resources:
    - tasks://{taskId}/state - Task status, assignedAgentId, complexity
    - tasks://{taskId}/files - List of files touched by task
    """

    def __init__(self, redis_adapter, postgres_adapter):
        """Initialize task resource provider.

        Args:
            redis_adapter: Redis cache adapter
            postgres_adapter: PostgreSQL sync adapter
        """
        self.redis = redis_adapter
        self.postgres = postgres_adapter

    async def list_resources(self) -> list[Any]:
        """List available task resources.

        Returns:
            List of resource descriptors
        """
        # TODO: Implement resource listing
        # This will query Redis for active tasks and return resource URIs
        logger.info("Listing task resources")
        return []

    async def read_resource(self, uri: str) -> str:
        """Read task resource by URI.

        Args:
            uri: Resource URI (e.g., tasks://task-123/state)

        Returns:
            Resource content as JSON string
        """
        logger.info(f"Reading task resource: {uri}")

        # Parse URI: tasks://{taskId}/{resource_type}
        if not uri.startswith("tasks://"):
            raise ValueError(f"Invalid task resource URI: {uri}")

        parts = uri[8:].split("/")
        if len(parts) < 2:
            raise ValueError(f"Invalid task resource URI format: {uri}")

        task_id = parts[0]
        resource_type = parts[1]

        # TODO: Implement resource reading from Redis cache
        if resource_type == "state":
            # Get task state from Redis
            task_data = await self.redis.get_task(task_id)
            if not task_data:
                raise ValueError(f"Task not found: {task_id}")
            return json.dumps(task_data)

        elif resource_type == "files":
            # Get list of files touched by this task
            files = await self.redis.get_task_files(task_id)
            return json.dumps({"files": files})

        else:
            raise ValueError(f"Unknown resource type: {resource_type}")
