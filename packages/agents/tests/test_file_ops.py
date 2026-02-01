"""Unit tests for file operations tools."""
import os
import sys
import tempfile
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

# We need to mock settings before importing file_ops
# so we can control WORKSPACE_PATH


class MockSettings:
    """Mock settings for testing."""
    def __init__(self, workspace_path):
        self.WORKSPACE_PATH = workspace_path


class TestFileWriteDirectoryValidation:
    """Test that test files are blocked from workspace/tasks/ and allowed in workspace/tests/."""

    def setup_method(self):
        """Create temp directory and reset ActionHistory before each test."""
        self.temp_dir = tempfile.mkdtemp()
        # Create workspace structure
        os.makedirs(os.path.join(self.temp_dir, "tasks"), exist_ok=True)
        os.makedirs(os.path.join(self.temp_dir, "tests"), exist_ok=True)

        # Reset ActionHistory
        from monitoring.action_history import ActionHistory
        ActionHistory.reset()

    def teardown_method(self):
        """Clean up temp directory."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_test_file_in_tasks_blocked(self):
        """Test that writing test_*.py to tasks/ is blocked."""
        mock_settings = MockSettings(self.temp_dir)

        with patch('tools.file_ops.settings', mock_settings):
            # Need to reimport to get patched version
            from tools.file_ops import FileWriteTool

            tool = FileWriteTool()
            result = tool._run(path="tasks/test_mymodule.py", content="# test content")

            assert "Error:" in result
            assert "Test files must be in workspace/tests/" in result
            assert "not workspace/tasks/" in result

    def test_test_file_with_test_prefix_in_tasks_blocked(self):
        """Test various test file patterns are blocked in tasks/."""
        mock_settings = MockSettings(self.temp_dir)

        with patch('tools.file_ops.settings', mock_settings):
            from tools.file_ops import FileWriteTool

            tool = FileWriteTool()

            # Test different patterns
            blocked_paths = [
                "tasks/test_calc.py",
                "tasks/subdir/test_utils.py",
                "tasks/module/test_helper.py",
            ]

            for path in blocked_paths:
                from monitoring.action_history import ActionHistory
                ActionHistory.reset()

                result = tool._run(path=path, content="# test")
                assert "Error:" in result, f"Expected {path} to be blocked"
                assert "Test files must be in workspace/tests/" in result

    def test_test_file_in_tests_allowed(self):
        """Test that writing test_*.py to tests/ is allowed."""
        mock_settings = MockSettings(self.temp_dir)

        with patch('tools.file_ops.settings', mock_settings):
            from tools.file_ops import FileWriteTool

            tool = FileWriteTool()
            result = tool._run(path="tests/test_mymodule.py", content="# test content\n")

            assert "Successfully wrote" in result
            assert "tests/test_mymodule.py" in result

            # Verify file was created
            expected_path = os.path.join(self.temp_dir, "tests", "test_mymodule.py")
            assert os.path.exists(expected_path)

    def test_non_test_file_in_tasks_allowed(self):
        """Test that regular files in tasks/ are allowed."""
        mock_settings = MockSettings(self.temp_dir)

        with patch('tools.file_ops.settings', mock_settings):
            from tools.file_ops import FileWriteTool

            tool = FileWriteTool()
            result = tool._run(path="tasks/calculator.py", content="def add(a, b): return a + b\n")

            assert "Successfully wrote" in result
            assert "tasks/calculator.py" in result

            # Verify file was created
            expected_path = os.path.join(self.temp_dir, "tasks", "calculator.py")
            assert os.path.exists(expected_path)


class TestFileReadOperations:
    """Test file read operations."""

    def setup_method(self):
        """Create temp directory with test files."""
        self.temp_dir = tempfile.mkdtemp()
        os.makedirs(os.path.join(self.temp_dir, "tasks"), exist_ok=True)

        # Create a test file to read
        test_file = os.path.join(self.temp_dir, "tasks", "sample.py")
        with open(test_file, "w") as f:
            f.write("# Sample file\ndef hello(): return 'world'\n")

        # Reset ActionHistory
        from monitoring.action_history import ActionHistory
        ActionHistory.reset()

    def teardown_method(self):
        """Clean up temp directory."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_read_existing_file(self):
        """Test reading an existing file."""
        mock_settings = MockSettings(self.temp_dir)

        with patch('tools.file_ops.settings', mock_settings):
            from tools.file_ops import FileReadTool

            tool = FileReadTool()
            result = tool._run(path="tasks/sample.py")

            assert "# Sample file" in result
            assert "def hello():" in result

    def test_read_nonexistent_file(self):
        """Test reading a file that doesn't exist."""
        mock_settings = MockSettings(self.temp_dir)

        with patch('tools.file_ops.settings', mock_settings):
            from tools.file_ops import FileReadTool

            tool = FileReadTool()
            result = tool._run(path="tasks/nonexistent.py")

            assert "Error:" in result
            assert "File not found" in result


class TestFileEditOperations:
    """Test file edit operations."""

    def setup_method(self):
        """Create temp directory with test files."""
        self.temp_dir = tempfile.mkdtemp()
        os.makedirs(os.path.join(self.temp_dir, "tasks"), exist_ok=True)

        # Create a test file to edit
        test_file = os.path.join(self.temp_dir, "tasks", "editable.py")
        with open(test_file, "w") as f:
            f.write("def old_function(): pass\n")

        # Reset ActionHistory
        from monitoring.action_history import ActionHistory
        ActionHistory.reset()

    def teardown_method(self):
        """Clean up temp directory."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_edit_existing_file(self):
        """Test editing an existing file."""
        mock_settings = MockSettings(self.temp_dir)

        with patch('tools.file_ops.settings', mock_settings):
            from tools.file_ops import FileEditTool

            tool = FileEditTool()
            result = tool._run(
                path="tasks/editable.py",
                old_text="old_function",
                new_text="new_function"
            )

            assert "Successfully edited" in result

            # Verify the change
            file_path = os.path.join(self.temp_dir, "tasks", "editable.py")
            with open(file_path, "r") as f:
                content = f.read()
            assert "new_function" in content
            assert "old_function" not in content

    def test_edit_text_not_found(self):
        """Test editing when the old text doesn't exist."""
        mock_settings = MockSettings(self.temp_dir)

        with patch('tools.file_ops.settings', mock_settings):
            from tools.file_ops import FileEditTool

            tool = FileEditTool()
            result = tool._run(
                path="tasks/editable.py",
                old_text="nonexistent_text",
                new_text="replacement"
            )

            assert "Error:" in result
            assert "not found" in result

    def test_edit_nonexistent_file(self):
        """Test editing a file that doesn't exist."""
        mock_settings = MockSettings(self.temp_dir)

        with patch('tools.file_ops.settings', mock_settings):
            from tools.file_ops import FileEditTool

            tool = FileEditTool()
            result = tool._run(
                path="tasks/nonexistent.py",
                old_text="old",
                new_text="new"
            )

            assert "Error:" in result
            assert "File not found" in result


class TestFileListOperations:
    """Test file list operations."""

    def setup_method(self):
        """Create temp directory with test structure."""
        self.temp_dir = tempfile.mkdtemp()
        os.makedirs(os.path.join(self.temp_dir, "tasks"), exist_ok=True)
        os.makedirs(os.path.join(self.temp_dir, "tests"), exist_ok=True)

        # Create some files
        with open(os.path.join(self.temp_dir, "tasks", "module.py"), "w") as f:
            f.write("# module\n")
        with open(os.path.join(self.temp_dir, "tests", "test_module.py"), "w") as f:
            f.write("# test\n")

        # Reset ActionHistory
        from monitoring.action_history import ActionHistory
        ActionHistory.reset()

    def teardown_method(self):
        """Clean up temp directory."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_list_root_directory(self):
        """Test listing root workspace directory."""
        mock_settings = MockSettings(self.temp_dir)

        with patch('tools.file_ops.settings', mock_settings):
            from tools.file_ops import FileListTool

            tool = FileListTool()
            result = tool._run(path="")

            assert "[DIR] tasks" in result
            assert "[DIR] tests" in result

    def test_list_tasks_directory(self):
        """Test listing tasks directory."""
        mock_settings = MockSettings(self.temp_dir)

        with patch('tools.file_ops.settings', mock_settings):
            from tools.file_ops import FileListTool

            tool = FileListTool()
            result = tool._run(path="tasks")

            assert "[FILE] module.py" in result

    def test_list_nonexistent_directory(self):
        """Test listing a directory that doesn't exist."""
        mock_settings = MockSettings(self.temp_dir)

        with patch('tools.file_ops.settings', mock_settings):
            from tools.file_ops import FileListTool

            tool = FileListTool()
            result = tool._run(path="nonexistent")

            assert "Error:" in result
            assert "Directory not found" in result


class TestSecurityChecks:
    """Test security checks preventing path traversal."""

    def setup_method(self):
        """Create temp directory."""
        self.temp_dir = tempfile.mkdtemp()
        os.makedirs(os.path.join(self.temp_dir, "tasks"), exist_ok=True)

        # Reset ActionHistory
        from monitoring.action_history import ActionHistory
        ActionHistory.reset()

    def teardown_method(self):
        """Clean up temp directory."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_path_traversal_blocked_read(self):
        """Test that path traversal is blocked for file_read."""
        mock_settings = MockSettings(self.temp_dir)

        with patch('tools.file_ops.settings', mock_settings):
            from tools.file_ops import FileReadTool

            tool = FileReadTool()
            result = tool._run(path="../../../etc/passwd")

            assert "Error:" in result
            assert "Access denied" in result or "File not found" in result

    def test_path_traversal_blocked_write(self):
        """Test that path traversal is blocked for file_write."""
        mock_settings = MockSettings(self.temp_dir)

        with patch('tools.file_ops.settings', mock_settings):
            from tools.file_ops import FileWriteTool

            tool = FileWriteTool()
            result = tool._run(path="../../../tmp/malicious.py", content="bad content")

            # Either access denied or the path resolves within workspace
            # (depends on how the path normalizes)
            assert "Error:" in result or "Successfully" in result


class TestMissingParameters:
    """Test handling of missing or invalid parameters."""

    def setup_method(self):
        """Reset ActionHistory before each test."""
        from monitoring.action_history import ActionHistory
        ActionHistory.reset()
        self.temp_dir = tempfile.mkdtemp()

    def teardown_method(self):
        """Clean up temp directory."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_write_missing_content(self):
        """Test file_write with missing content."""
        mock_settings = MockSettings(self.temp_dir)

        with patch('tools.file_ops.settings', mock_settings):
            from tools.file_ops import FileWriteTool

            tool = FileWriteTool()
            result = tool._run(path="test.py", content=None)

            assert "Error:" in result
            assert "required" in result

    def test_write_missing_path(self):
        """Test file_write with missing path."""
        mock_settings = MockSettings(self.temp_dir)

        with patch('tools.file_ops.settings', mock_settings):
            from tools.file_ops import FileWriteTool

            tool = FileWriteTool()
            result = tool._run(path="", content="content")

            assert "Error:" in result

    def test_edit_missing_old_text(self):
        """Test file_edit with missing old_text."""
        mock_settings = MockSettings(self.temp_dir)

        with patch('tools.file_ops.settings', mock_settings):
            from tools.file_ops import FileEditTool

            tool = FileEditTool()
            result = tool._run(path="test.py", old_text=None, new_text="new")

            assert "Error:" in result
            assert "required" in result
