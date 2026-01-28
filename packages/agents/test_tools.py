#!/usr/bin/env python3
"""Test script to verify agent tool usage."""

import asyncio
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from src.agents import create_coder_agent
from src.models.ollama import get_ollama_llm, check_ollama_available
from crewai import Task, Crew


def test_simple_file_write():
    """Test if agent can write a simple hello world file."""
    print("=" * 60)
    print("Testing agent tool usage...")
    print("=" * 60)

    # Check Ollama
    if not check_ollama_available():
        print("❌ Ollama not available!")
        return False
    print("✅ Ollama is available")

    # Create LLM and agent
    print("\n📦 Creating agent with tools...")
    llm = get_ollama_llm()
    agent = create_coder_agent(llm)

    print(f"   Agent role: {agent.role}")
    print(f"   Tools available: {[tool.name for tool in agent.tools]}")

    # Create simple task
    print("\n📝 Creating task: Write hello.txt file")
    task = Task(
        description="""Create a file called 'hello.txt' in the workspace with the content 'Hello World from ABCC!'.

You MUST use the file_write tool to create this file.
Then use the file_list tool to verify it was created.""",
        expected_output="File hello.txt created successfully with the correct content and verified to exist",
        agent=agent,
    )

    # Run the crew
    print("\n🚀 Starting agent execution...")
    print("-" * 60)
    crew = Crew(
        agents=[agent],
        tasks=[task],
        verbose=True,  # This should show tool calls
    )

    result = crew.kickoff()

    print("-" * 60)
    print("\n📊 Result:")
    print(result)

    # Check if file exists
    workspace_path = Path("/app/workspace")
    hello_file = workspace_path / "hello.txt"

    print("\n🔍 Verification:")
    if hello_file.exists():
        print(f"✅ File exists at {hello_file}")
        content = hello_file.read_text()
        print(f"   Content: {content}")
        return True
    else:
        print(f"❌ File NOT found at {hello_file}")
        print(f"   Workspace contents: {list(workspace_path.iterdir())}")
        return False


if __name__ == "__main__":
    success = test_simple_file_write()
    sys.exit(0 if success else 1)
