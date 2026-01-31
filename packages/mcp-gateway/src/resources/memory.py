"""Memory resource provider for MCP - Cross-task learning."""

import json
import logging
from typing import Any, Optional
import httpx

logger = logging.getLogger(__name__)

# API URL for memory endpoints
API_URL = "http://api:3001/api/memories"


class MemoryResourceProvider:
    """Provides cross-task memory resources via MCP.

    Resources:
    - memory://{taskType} - Approved memories for a task type
    - memory://search?keywords={keywords} - Search memories by keywords
    """

    def __init__(self, redis_adapter, postgres_adapter):
        """Initialize memory resource provider.

        Args:
            redis_adapter: Redis cache adapter
            postgres_adapter: PostgreSQL sync adapter
        """
        self.redis = redis_adapter
        self.postgres = postgres_adapter
        self._client = httpx.AsyncClient(timeout=30.0)

    async def list_resources(self) -> list[Any]:
        """List available memory resources.

        Returns:
            List of resource descriptors with URI, name, description
        """
        logger.info("Listing memory resources")

        # List memory resources by task type
        resources = [
            {
                "uri": "memory://file_creation",
                "name": "File Creation Memories",
                "description": "Approved patterns for file creation tasks",
                "mimeType": "application/json"
            },
            {
                "uri": "memory://bug_fix",
                "name": "Bug Fix Memories",
                "description": "Approved patterns for bug fixing tasks",
                "mimeType": "application/json"
            },
            {
                "uri": "memory://refactor",
                "name": "Refactoring Memories",
                "description": "Approved patterns for refactoring tasks",
                "mimeType": "application/json"
            },
            {
                "uri": "memory://test",
                "name": "Testing Memories",
                "description": "Approved patterns for testing tasks",
                "mimeType": "application/json"
            },
        ]

        return resources

    async def read_resource(self, uri: str) -> str:
        """Read memory resource by URI.

        Args:
            uri: Resource URI (e.g., memory://file_creation)

        Returns:
            Resource content as JSON string
        """
        logger.info(f"Reading memory resource: {uri}")

        if not uri.startswith("memory://"):
            raise ValueError(f"Invalid memory resource URI: {uri}")

        # Parse URI: memory://{taskType} or memory://search?keywords={keywords}
        path = uri[9:]  # Remove memory://

        if path.startswith("search"):
            # Search by keywords
            keywords = ""
            if "?" in path:
                query_string = path.split("?", 1)[1]
                for param in query_string.split("&"):
                    if param.startswith("keywords="):
                        keywords = param.split("=", 1)[1]

            return await self._search_memories(keywords)
        else:
            # Get by task type
            task_type = path.split("/")[0] if "/" in path else path
            return await self._get_memories_by_type(task_type)

    async def _get_memories_by_type(self, task_type: str, limit: int = 10) -> str:
        """Get approved memories for a task type.

        Args:
            task_type: Type of task (file_creation, bug_fix, etc.)
            limit: Maximum memories to return

        Returns:
            JSON string with memories
        """
        # Check Redis cache first
        cache_key = f"memory:type:{task_type}"
        cached = await self.redis.get(cache_key)
        if cached:
            logger.info(f"Memory cache hit for {task_type}")
            return cached

        # Query API
        try:
            response = await self._client.get(
                f"{API_URL}/approved",
                params={"taskType": task_type, "limit": limit}
            )
            response.raise_for_status()
            data = response.json()

            # Cache in Redis (1 hour TTL)
            await self.redis.setex(cache_key, 3600, json.dumps(data))

            return json.dumps(data)
        except Exception as e:
            logger.error(f"Error fetching memories by type: {e}")
            return json.dumps({"memories": [], "error": str(e)})

    async def _search_memories(self, keywords: str, limit: int = 10) -> str:
        """Search memories by keywords.

        Args:
            keywords: Comma-separated keywords
            limit: Maximum memories to return

        Returns:
            JSON string with matching memories
        """
        # Check Redis cache first (short TTL for searches)
        cache_key = f"memory:search:{hash(keywords)}"
        cached = await self.redis.get(cache_key)
        if cached:
            logger.info(f"Memory search cache hit for {keywords}")
            return cached

        # Query API
        try:
            response = await self._client.get(
                f"{API_URL}/search",
                params={"keywords": keywords, "limit": limit}
            )
            response.raise_for_status()
            data = response.json()

            # Cache in Redis (5 min TTL for searches)
            await self.redis.setex(cache_key, 300, json.dumps(data))

            return json.dumps(data)
        except Exception as e:
            logger.error(f"Error searching memories: {e}")
            return json.dumps({"memories": [], "error": str(e)})

    async def propose_memory(
        self,
        task_type: str,
        pattern: str,
        solution: str,
        error_pattern: Optional[str] = None,
        keywords: Optional[list[str]] = None,
        proposed_by_task: Optional[str] = None,
        proposed_by_agent: Optional[str] = None
    ) -> dict:
        """Propose a new memory for human approval.

        Args:
            task_type: Type of task
            pattern: Problem pattern encountered
            solution: How it was solved
            error_pattern: Optional error that was fixed
            keywords: Searchable keywords
            proposed_by_task: Task ID that generated this
            proposed_by_agent: Agent that proposed this

        Returns:
            Created memory record
        """
        try:
            response = await self._client.post(
                API_URL,
                json={
                    "taskType": task_type,
                    "pattern": pattern,
                    "solution": solution,
                    "errorPattern": error_pattern,
                    "keywords": keywords or [],
                    "proposedByTask": proposed_by_task,
                    "proposedByAgent": proposed_by_agent,
                }
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error proposing memory: {e}")
            raise

    async def record_feedback(self, memory_id: str, success: bool) -> dict:
        """Record feedback on memory usage.

        Args:
            memory_id: Memory ID
            success: Whether the memory was helpful

        Returns:
            Updated memory record
        """
        try:
            response = await self._client.post(
                f"{API_URL}/{memory_id}/feedback",
                json={"success": success}
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error recording memory feedback: {e}")
            raise
