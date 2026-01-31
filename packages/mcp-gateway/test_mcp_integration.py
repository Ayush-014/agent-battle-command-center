"""Test MCP Gateway resources and tools integration.

This test suite verifies that all MCP resources and tools work correctly:
- TaskResourceProvider (list resources, read task state, read task files)
- FileResourceProvider (read/write files with locks)
- LogResourceProvider (append logs, stream logs)
- FileOperationTools (file_read, file_write, claim_file, release_file)
- CollaborationTools (log_step, subscribe_logs, join/leave collaboration)
"""

import asyncio
import json
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from src.adapters.redis import RedisAdapter
from src.adapters.postgres import PostgresAdapter
from src.resources.tasks import TaskResourceProvider
from src.resources.files import FileResourceProvider
from src.resources.logs import LogResourceProvider
from src.tools.file_ops import FileOperationTools
from src.tools.collaboration import CollaborationTools


class MCPIntegrationTest:
    """MCP Gateway integration test suite."""

    def __init__(self):
        """Initialize test suite."""
        self.redis = None
        self.postgres = None
        self.task_provider = None
        self.file_provider = None
        self.log_provider = None
        self.file_tools = None
        self.collab_tools = None
        self.test_task_id = "test-task-123"
        self.test_agent_id = "test-agent-01"
        self.results = []

    async def setup(self):
        """Setup adapters and providers."""
        print("🔧 Setting up adapters and providers...")

        # Initialize adapters
        self.redis = RedisAdapter()
        await self.redis.connect()
        print("✅ Redis adapter connected")

        self.postgres = PostgresAdapter(self.redis)
        await self.postgres.connect()
        print("✅ PostgreSQL adapter connected")

        # Initialize resource providers
        self.task_provider = TaskResourceProvider(self.redis, self.postgres)
        self.file_provider = FileResourceProvider(self.redis)
        self.log_provider = LogResourceProvider(self.redis)
        print("✅ Resource providers initialized")

        # Initialize tool providers
        self.file_tools = FileOperationTools(self.redis, self.file_provider)
        self.collab_tools = CollaborationTools(self.redis, self.log_provider)
        print("✅ Tool providers initialized")

    async def teardown(self):
        """Cleanup test resources."""
        print("\n🧹 Cleaning up test resources...")

        # Delete test task from Redis
        await self.redis.delete(f"task:{self.test_task_id}")
        await self.redis.delete(f"task_files:{self.test_task_id}")
        await self.redis.delete(f"logs:{self.test_task_id}")
        await self.redis.delete(f"collaboration:{self.test_task_id}")

        # Close connections
        if self.postgres:
            await self.postgres.close()
        if self.redis:
            await self.redis.close()

        print("✅ Cleanup complete")

    def log_result(self, test_name: str, passed: bool, message: str = ""):
        """Log test result."""
        self.results.append({
            "test": test_name,
            "passed": passed,
            "message": message
        })
        icon = "✅" if passed else "❌"
        print(f"{icon} {test_name}: {message if message else 'PASSED' if passed else 'FAILED'}")

    async def test_task_state_cache(self):
        """Test 1: Task state caching in Redis."""
        print("\n📝 Test 1: Task state caching")

        # Create test task in Redis
        task_data = {
            "id": self.test_task_id,
            "title": "Test Task",
            "description": "Test task for MCP integration",
            "status": "pending",
            "assigned_agent_id": None,
            "final_complexity": 5.0,
        }

        await self.redis.set_task(self.test_task_id, task_data)

        # Verify task can be retrieved
        retrieved = await self.redis.get_task(self.test_task_id)

        if retrieved and retrieved["id"] == self.test_task_id:
            self.log_result("Task state cache", True, f"Task {self.test_task_id} cached successfully")
        else:
            self.log_result("Task state cache", False, "Failed to retrieve cached task")

    async def test_task_resource_listing(self):
        """Test 2: List task resources."""
        print("\n📋 Test 2: Task resource listing")

        resources = await self.task_provider.list_resources()

        if any(r["uri"] == f"tasks://{self.test_task_id}/state" for r in resources):
            self.log_result("Task resource listing", True, f"Found {len(resources)} resources")
        else:
            self.log_result("Task resource listing", False, "Test task not in resource list")

    async def test_task_state_read(self):
        """Test 3: Read task state resource."""
        print("\n🔍 Test 3: Read task state resource")

        uri = f"tasks://{self.test_task_id}/state"
        content = await self.task_provider.read_resource(uri)
        data = json.loads(content)

        if data["id"] == self.test_task_id and data["title"] == "Test Task":
            self.log_result("Task state read", True, f"Read task state: {data['title']}")
        else:
            self.log_result("Task state read", False, "Task state mismatch")

    async def test_file_write_and_read(self):
        """Test 4: File write and read operations."""
        print("\n📄 Test 4: File write and read")

        test_file = "test_calc.py"
        test_content = "def add(a, b):\n    return a + b\n"

        # Write file
        write_result = await self.file_tools.file_write(
            self.test_task_id, test_file, test_content
        )

        if not write_result.get("success"):
            self.log_result("File write", False, f"Write failed: {write_result.get('error')}")
            return

        # Read file
        read_result = await self.file_tools.file_read(self.test_task_id, test_file)

        if read_result.get("success") and read_result.get("content") == test_content:
            self.log_result("File write and read", True, f"File {test_file} written and read successfully")
        else:
            self.log_result("File write and read", False, "File content mismatch")

    async def test_file_locks(self):
        """Test 5: Distributed file locks."""
        print("\n🔒 Test 5: File lock acquisition and release")

        test_file = "locked_file.py"

        # Agent 1 claims file
        claim_result = await self.file_tools.claim_file(self.test_task_id, test_file, timeout_sec=60)

        if not claim_result.get("success"):
            self.log_result("File lock claim", False, f"Lock failed: {claim_result.get('error')}")
            return

        # Agent 2 tries to claim same file (should fail)
        other_agent = "other-agent-02"
        second_claim = await self.file_tools.claim_file(other_agent, test_file, timeout_sec=60)

        if second_claim.get("success"):
            self.log_result("File lock conflict", False, "Second agent acquired lock (should fail)")
            return

        # Release lock
        release_result = await self.file_tools.release_file(self.test_task_id, test_file)

        if release_result.get("success"):
            self.log_result("File lock acquisition and release", True, "Lock acquired and released correctly")
        else:
            self.log_result("File lock release", False, f"Release failed: {release_result.get('error')}")

    async def test_log_streaming(self):
        """Test 6: Execution log streaming."""
        print("\n📡 Test 6: Execution log streaming")

        # Log a step
        step = {
            "action": "file_write",
            "path": "test_calc.py",
            "status": "success",
        }

        log_result = await self.collab_tools.log_step(self.test_task_id, step)

        if not log_result.get("success"):
            self.log_result("Log step", False, f"Log failed: {log_result.get('error')}")
            return

        # Read logs
        logs = await self.redis.get_logs(self.test_task_id, limit=10)

        if logs and any(log.get("action") == "file_write" for log in logs):
            self.log_result("Log streaming", True, f"Logged and retrieved {len(logs)} steps")
        else:
            self.log_result("Log streaming", False, "Log step not found")

    async def test_collaboration_join(self):
        """Test 7: Agent collaboration join/leave."""
        print("\n🤝 Test 7: Agent collaboration")

        # Join collaboration
        join_result = await self.collab_tools.join_collaboration(
            self.test_task_id, self.test_agent_id
        )

        if not join_result.get("success"):
            self.log_result("Collaboration join", False, f"Join failed: {join_result.get('error')}")
            return

        # Get collaborating agents
        agents_result = await self.collab_tools.get_collaborating_agents(self.test_task_id)

        if self.test_agent_id in agents_result.get("agents", []):
            self.log_result("Collaboration join", True, f"Agent {self.test_agent_id} joined collaboration")
        else:
            self.log_result("Collaboration join", False, "Agent not in collaboration set")

        # Leave collaboration
        leave_result = await self.collab_tools.leave_collaboration(
            self.test_task_id, self.test_agent_id
        )

        if leave_result.get("success"):
            self.log_result("Collaboration leave", True, "Agent left collaboration")
        else:
            self.log_result("Collaboration leave", False, f"Leave failed: {leave_result.get('error')}")

    async def run_all_tests(self):
        """Run all integration tests."""
        print("=" * 70)
        print("🧪 MCP Gateway Integration Test Suite")
        print("=" * 70)

        try:
            await self.setup()

            # Run tests
            await self.test_task_state_cache()
            await self.test_task_resource_listing()
            await self.test_task_state_read()
            await self.test_file_write_and_read()
            await self.test_file_locks()
            await self.test_log_streaming()
            await self.test_collaboration_join()

        except Exception as e:
            print(f"\n❌ Test suite error: {e}")
            import traceback
            traceback.print_exc()

        finally:
            await self.teardown()

        # Print summary
        print("\n" + "=" * 70)
        print("📊 Test Summary")
        print("=" * 70)

        passed = sum(1 for r in self.results if r["passed"])
        total = len(self.results)

        for result in self.results:
            icon = "✅" if result["passed"] else "❌"
            print(f"{icon} {result['test']}")

        print(f"\n✨ Tests passed: {passed}/{total}")

        if passed == total:
            print("🎉 All tests passed!")
            return 0
        else:
            print(f"⚠️  {total - passed} test(s) failed")
            return 1


async def main():
    """Main entry point."""
    test_suite = MCPIntegrationTest()
    exit_code = await test_suite.run_all_tests()
    sys.exit(exit_code)


if __name__ == "__main__":
    asyncio.run(main())
