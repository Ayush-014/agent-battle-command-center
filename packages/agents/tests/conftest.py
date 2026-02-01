"""Pytest configuration and shared fixtures for agents tests."""
import sys
from pathlib import Path

import pytest

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))


@pytest.fixture(autouse=True)
def reset_action_history():
    """Reset ActionHistory singleton before each test."""
    from monitoring.action_history import ActionHistory
    ActionHistory.reset()
    yield
    ActionHistory.reset()
