from crewai import Agent
from src.tools import (
    file_read,
    file_write,
    file_edit,
    file_list,
    shell_run,
    code_search,
    find_file,
    review_code,
    query_logs,
    assign_task,
    escalate_task,
    get_task_info,
    list_agents,
    create_subtask,
    complete_decomposition,
)


def create_base_agent(
    role: str,
    goal: str,
    backstory: str,
    tools: list | None = None,
    llm=None,
    verbose: bool = True,
) -> Agent:
    """Create a base agent with common configuration."""
    return Agent(
        role=role,
        goal=goal,
        backstory=backstory,
        tools=tools or [],
        llm=llm,
        verbose=verbose,
        allow_delegation=False,  # Backend handles delegation
        max_iter=25,
        max_rpm=10,
    )


# Default tool sets for different agent types
CODER_TOOLS = [file_read, file_write, file_edit, file_list, shell_run, code_search, find_file]
QA_TOOLS = [file_read, file_write, file_list, shell_run, code_search, find_file]
CTO_TOOLS = [
    review_code,
    query_logs,
    assign_task,
    escalate_task,
    get_task_info,
    list_agents,
    create_subtask,  # CTO can decompose tasks
    complete_decomposition,  # CTO can mark decomposition complete
    file_read,  # CTO can read files for review
    file_list,  # CTO can list files
    code_search,  # CTO can search codebase
]
