"""PostgreSQL adapter for state synchronization."""

import asyncio
import json
import logging
from collections import deque
from datetime import datetime
from typing import Optional

import asyncpg

from src.config import settings
from src.adapters.redis import RedisAdapter

logger = logging.getLogger(__name__)


class PostgresAdapter:
    """PostgreSQL adapter for state synchronization.

    Features:
    - Pull changes from PostgreSQL every 1s (sync_from_postgres)
    - Batch write to PostgreSQL every 5s (sync_to_postgres)
    - Conflict resolution (last-write-wins)
    """

    def __init__(self, redis_adapter: RedisAdapter):
        """Initialize PostgreSQL adapter.

        Args:
            redis_adapter: Redis cache adapter
        """
        self.redis = redis_adapter
        self.pool: Optional[asyncpg.Pool] = None
        self.write_queue: deque = deque()
        self.last_sync_timestamp: Optional[datetime] = None

    async def connect(self):
        """Connect to PostgreSQL."""
        logger.info(f"Connecting to PostgreSQL: {settings.postgres_host}:{settings.postgres_port}")

        self.pool = await asyncpg.create_pool(
            dsn=settings.postgres_dsn,
            min_size=settings.postgres_pool_min,
            max_size=settings.postgres_pool_max,
        )

        # Test connection
        async with self.pool.acquire() as conn:
            version = await conn.fetchval("SELECT version()")
            logger.info(f"PostgreSQL connected: {version}")

        # Initialize last sync timestamp
        self.last_sync_timestamp = datetime.utcnow()

    async def close(self):
        """Close PostgreSQL connection."""
        if self.pool:
            await self.pool.close()
            logger.info("PostgreSQL connection closed")

    async def sync_from_postgres(self):
        """Pull changes from PostgreSQL every 1s and update Redis cache.

        This background task continuously syncs task state from PostgreSQL
        to Redis to ensure agents have up-to-date information.
        """
        logger.info("Starting sync_from_postgres background task")

        while True:
            try:
                await asyncio.sleep(settings.sync_from_postgres_interval)

                # Fetch tasks updated since last sync
                async with self.pool.acquire() as conn:
                    query = """
                        SELECT id, title, description, status, assigned_agent_id,
                               final_complexity, created_at, updated_at
                        FROM tasks
                        WHERE updated_at > $1
                        ORDER BY updated_at DESC
                        LIMIT $2
                    """
                    rows = await conn.fetch(
                        query, self.last_sync_timestamp, settings.sync_batch_size
                    )

                    if rows:
                        logger.debug(f"Syncing {len(rows)} tasks from PostgreSQL to Redis")

                        # Update Redis cache
                        for row in rows:
                            task_data = dict(row)

                            # Convert datetime objects to ISO strings
                            for key in ["created_at", "updated_at"]:
                                if task_data.get(key):
                                    task_data[key] = task_data[key].isoformat()

                            await self.redis.set_task(task_data["id"], task_data)

                        # Update last sync timestamp
                        self.last_sync_timestamp = rows[0]["updated_at"]

            except Exception as e:
                logger.error(f"Error in sync_from_postgres: {e}", exc_info=True)
                await asyncio.sleep(5)  # Back off on error

    async def sync_to_postgres(self):
        """Batch write Redis changes to PostgreSQL every 5s.

        This background task processes the write queue and persists
        changes to PostgreSQL in batches.
        """
        logger.info("Starting sync_to_postgres background task")

        while True:
            try:
                await asyncio.sleep(settings.sync_to_postgres_interval)

                if not self.write_queue:
                    continue

                # Collect pending writes (up to batch size)
                batch = []
                while self.write_queue and len(batch) < settings.sync_batch_size:
                    batch.append(self.write_queue.popleft())

                if not batch:
                    continue

                logger.debug(f"Batch writing {len(batch)} operations to PostgreSQL")

                # Execute batch
                async with self.pool.acquire() as conn:
                    async with conn.transaction():
                        for write_op in batch:
                            try:
                                await conn.execute(write_op["sql"], *write_op["params"])
                            except Exception as e:
                                logger.error(
                                    f"Error executing write operation: {e}\n"
                                    f"SQL: {write_op['sql']}\n"
                                    f"Params: {write_op['params']}"
                                )

                logger.debug(f"Batch write completed ({len(batch)} operations)")

            except Exception as e:
                logger.error(f"Error in sync_to_postgres: {e}", exc_info=True)
                await asyncio.sleep(5)  # Back off on error

    def queue_write(self, sql: str, *params):
        """Queue a write operation for batch processing.

        Args:
            sql: SQL statement
            params: SQL parameters
        """
        self.write_queue.append({"sql": sql, "params": params})

    async def get_sync_lag(self) -> float:
        """Get current sync lag in milliseconds.

        Returns:
            Sync lag in milliseconds
        """
        if not self.last_sync_timestamp:
            return 0.0

        lag = datetime.utcnow() - self.last_sync_timestamp
        return lag.total_seconds() * 1000

    async def fetch_task(self, task_id: str) -> Optional[dict]:
        """Fetch task from PostgreSQL.

        Args:
            task_id: Task ID

        Returns:
            Task data dictionary or None if not found
        """
        async with self.pool.acquire() as conn:
            query = """
                SELECT id, title, description, status, assigned_agent_id,
                       final_complexity, created_at, updated_at
                FROM tasks
                WHERE id = $1
            """
            row = await conn.fetchrow(query, task_id)

            if not row:
                return None

            task_data = dict(row)

            # Convert datetime objects to ISO strings
            for key in ["created_at", "updated_at"]:
                if task_data.get(key):
                    task_data[key] = task_data[key].isoformat()

            return task_data

    async def update_task_status(self, task_id: str, status: str):
        """Update task status.

        Args:
            task_id: Task ID
            status: New status
        """
        sql = """
            UPDATE tasks
            SET status = $1, updated_at = NOW()
            WHERE id = $2
        """
        self.queue_write(sql, status, task_id)

    async def log_execution_step(
        self,
        task_id: str,
        agent_id: str,
        action: str,
        action_input: dict,
        observation: str,
        step: int = 0,
        model: str = None,
    ):
        """Log execution step to PostgreSQL.

        Args:
            task_id: Task ID
            agent_id: Agent ID
            action: Action name
            action_input: Action input (JSON)
            observation: Action observation
            step: Step number
            model: Model used (optional)
        """
        sql = """
            INSERT INTO execution_logs (
                id, task_id, agent_id, step, action, "actionInput",
                observation, model_used
            ) VALUES (
                gen_random_uuid()::text, $1, $2, $3, $4, $5::jsonb, $6, $7
            )
        """
        import json
        action_input_json = json.dumps(action_input) if isinstance(action_input, dict) else action_input
        self.queue_write(sql, task_id, agent_id, step, action, action_input_json, observation, model)
