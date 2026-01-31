"""MCP Server main entry point."""

import asyncio
import logging
import sys
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server

from src.config import settings
from src.resources.tasks import TaskResourceProvider
from src.resources.files import FileResourceProvider
from src.resources.logs import LogResourceProvider
from src.tools.file_ops import FileOperationTools
from src.tools.collaboration import CollaborationTools
from src.adapters.redis import RedisAdapter
from src.adapters.postgres import PostgresAdapter

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stderr)],
)

logger = logging.getLogger(__name__)


class MCPGatewayServer:
    """MCP Gateway Server for agent-to-agent collaboration."""

    def __init__(self):
        """Initialize MCP Gateway server."""
        self.server = Server(settings.mcp_server_name)
        self.redis_adapter: RedisAdapter | None = None
        self.postgres_adapter: PostgresAdapter | None = None
        self.sync_tasks: list[asyncio.Task] = []

        # Resource providers
        self.task_provider: TaskResourceProvider | None = None
        self.file_provider: FileResourceProvider | None = None
        self.log_provider: LogResourceProvider | None = None

        # Tool providers
        self.file_tools: FileOperationTools | None = None
        self.collab_tools: CollaborationTools | None = None

    async def initialize(self):
        """Initialize adapters and providers."""
        logger.info("Initializing MCP Gateway server...")

        # Initialize adapters
        self.redis_adapter = RedisAdapter()
        await self.redis_adapter.connect()
        logger.info("Redis adapter connected")

        self.postgres_adapter = PostgresAdapter(self.redis_adapter)
        await self.postgres_adapter.connect()
        logger.info("PostgreSQL adapter connected")

        # Initialize resource providers
        self.task_provider = TaskResourceProvider(self.redis_adapter, self.postgres_adapter)
        self.file_provider = FileResourceProvider(self.redis_adapter)
        self.log_provider = LogResourceProvider(self.redis_adapter)

        # Initialize tool providers
        self.file_tools = FileOperationTools(self.redis_adapter, self.file_provider)
        self.collab_tools = CollaborationTools(self.redis_adapter, self.log_provider)

        # Register resources
        await self._register_resources()

        # Register tools
        await self._register_tools()

        # Start background sync tasks
        await self._start_sync_tasks()

        logger.info("MCP Gateway server initialized successfully")

    async def _register_resources(self):
        """Register MCP resources."""
        logger.info("Registering MCP resources...")

        # Task resources
        @self.server.list_resources()
        async def list_task_resources() -> list[Any]:
            """List available task resources."""
            return await self.task_provider.list_resources()

        @self.server.read_resource()
        async def read_task_resource(uri: str) -> str:
            """Read task resource by URI."""
            return await self.task_provider.read_resource(uri)

        # File resources
        @self.server.read_resource()
        async def read_file_resource(uri: str) -> str:
            """Read file resource by URI."""
            if uri.startswith("workspace://"):
                return await self.file_provider.read_resource(uri)
            raise ValueError(f"Unknown resource URI: {uri}")

        # Log resources (streaming)
        @self.server.read_resource()
        async def read_log_resource(uri: str) -> str:
            """Read log resource by URI."""
            if uri.startswith("logs://"):
                return await self.log_provider.read_resource(uri)
            raise ValueError(f"Unknown resource URI: {uri}")

        logger.info("MCP resources registered")

    async def _register_tools(self):
        """Register MCP tools."""
        logger.info("Registering MCP tools...")

        # File operation tools
        @self.server.call_tool()
        async def mcp_file_read(task_id: str, path: str) -> dict:
            """Read file via MCP."""
            return await self.file_tools.file_read(task_id, path)

        @self.server.call_tool()
        async def mcp_file_write(task_id: str, path: str, content: str) -> dict:
            """Write file via MCP."""
            return await self.file_tools.file_write(task_id, path, content)

        @self.server.call_tool()
        async def mcp_claim_file(task_id: str, path: str) -> dict:
            """Claim file lock."""
            return await self.file_tools.claim_file(task_id, path)

        @self.server.call_tool()
        async def mcp_release_file(task_id: str, path: str) -> dict:
            """Release file lock."""
            return await self.file_tools.release_file(task_id, path)

        # Collaboration tools
        @self.server.call_tool()
        async def mcp_log_step(task_id: str, step: dict) -> dict:
            """Log execution step."""
            return await self.collab_tools.log_step(task_id, step)

        @self.server.call_tool()
        async def mcp_subscribe_logs(task_id: str) -> dict:
            """Subscribe to task logs."""
            return await self.collab_tools.subscribe_logs(task_id)

        logger.info("MCP tools registered")

    async def _start_sync_tasks(self):
        """Start background synchronization tasks."""
        logger.info("Starting background sync tasks...")

        # Sync from PostgreSQL (pull changes every 1s)
        sync_from_task = asyncio.create_task(self.postgres_adapter.sync_from_postgres())
        self.sync_tasks.append(sync_from_task)

        # Sync to PostgreSQL (batch writes every 5s)
        sync_to_task = asyncio.create_task(self.postgres_adapter.sync_to_postgres())
        self.sync_tasks.append(sync_to_task)

        logger.info(f"Started {len(self.sync_tasks)} sync tasks")

    async def shutdown(self):
        """Shutdown server and cleanup resources."""
        logger.info("Shutting down MCP Gateway server...")

        # Cancel sync tasks
        for task in self.sync_tasks:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        # Close adapters
        if self.postgres_adapter:
            await self.postgres_adapter.close()
        if self.redis_adapter:
            await self.redis_adapter.close()

        logger.info("MCP Gateway server shut down successfully")

    async def run(self, daemon_mode: bool = False):
        """Run the MCP server.

        Args:
            daemon_mode: If True, run as a daemon (keep sync tasks running)
                        If False, wait for stdio client connection
        """
        try:
            await self.initialize()

            # Daemon mode: keep sync tasks running without stdio
            if daemon_mode:
                logger.info("Starting MCP server in daemon mode (sync tasks only)...")
                logger.info("Server will keep sync tasks running until interrupted")

                # Keep server running by waiting on sync tasks
                try:
                    await asyncio.gather(*self.sync_tasks)
                except asyncio.CancelledError:
                    logger.info("Sync tasks cancelled, shutting down...")

            # Client mode: wait for stdio connection
            elif settings.mcp_transport == "stdio":
                logger.info("Starting MCP server with stdio transport...")
                async with stdio_server() as (read_stream, write_stream):
                    await self.server.run(
                        read_stream,
                        write_stream,
                        self.server.create_initialization_options(),
                    )
            else:
                raise ValueError(f"Unsupported transport: {settings.mcp_transport}")

        except Exception as e:
            logger.error(f"Error running MCP server: {e}", exc_info=True)
            raise
        finally:
            await self.shutdown()


async def main():
    """Main entry point."""
    # Health check mode
    if "--health-check" in sys.argv:
        print('{"status": "healthy", "version": "1.0.0"}')
        sys.exit(0)

    # Daemon mode (for Docker)
    daemon_mode = "--daemon" in sys.argv

    # Run server
    server = MCPGatewayServer()
    await server.run(daemon_mode=daemon_mode)


if __name__ == "__main__":
    asyncio.run(main())
