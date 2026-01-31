"""Debug script to check list_resources output."""

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from src.adapters.redis import RedisAdapter
from src.adapters.postgres import PostgresAdapter
from src.resources.tasks import TaskResourceProvider


async def main():
    """Debug list_resources."""
    redis = RedisAdapter()
    await redis.connect()
    print("✅ Redis connected\n")

    postgres = PostgresAdapter(redis)
    await postgres.connect()
    print("✅ PostgreSQL connected\n")

    task_provider = TaskResourceProvider(redis, postgres)

    # Create a test task
    test_task_id = "debug-task-456"
    task_data = {
        "id": test_task_id,
        "title": "Debug Task",
        "description": "Debug task",
        "status": "pending",
    }

    print(f"📝 Creating task: {test_task_id}")
    await redis.set_task(test_task_id, task_data)

    # Check what keys exist
    print("\n🔍 Checking Redis keys:")
    all_keys = await redis.keys("*")
    print(f"All keys: {all_keys}")

    task_keys = await redis.keys("task:*")
    print(f"Task keys: {task_keys}")

    # List resources
    print("\n📋 Listing resources:")
    resources = await task_provider.list_resources()
    print(f"Found {len(resources)} resources:")
    for r in resources:
        print(f"  - {r['uri']}: {r['name']}")

    # Check if our task is in the list
    found = any(r["uri"] == f"tasks://{test_task_id}/state" for r in resources)
    print(f"\n✅ Task {test_task_id} found in list: {found}")

    # Cleanup
    await redis.delete(f"task:{test_task_id}")
    await postgres.close()
    await redis.close()


if __name__ == "__main__":
    asyncio.run(main())
