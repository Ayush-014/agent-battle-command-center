from crewai import Agent
from src.config import settings
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

# MCP tools (only imported if USE_MCP is enabled)
if settings.USE_MCP:
    from src.tools.mcp_file_ops import (
        mcp_file_read,
        mcp_file_write,
        mcp_file_edit,
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


# Default tool sets for different agent types (HTTP mode)
CODER_TOOLS_HTTP = [file_read, file_write, file_edit, file_list, shell_run, code_search, find_file]
QA_TOOLS_HTTP = [file_read, file_write, file_list, shell_run, code_search, find_file]
CTO_TOOLS_HTTP = [
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

# MCP tool sets (real-time collaboration mode)
if settings.USE_MCP:
    CODER_TOOLS_MCP = [mcp_file_read, mcp_file_write, mcp_file_edit, file_list, shell_run, code_search, find_file]
    QA_TOOLS_MCP = [mcp_file_read, mcp_file_write, file_list, shell_run, code_search, find_file]
    CTO_TOOLS_MCP = CTO_TOOLS_HTTP  # CTO doesn't use file write, so no MCP needed
else:
    CODER_TOOLS_MCP = CODER_TOOLS_HTTP
    QA_TOOLS_MCP = QA_TOOLS_HTTP
    CTO_TOOLS_MCP = CTO_TOOLS_HTTP

# Active tool sets (selected based on USE_MCP flag)
CODER_TOOLS = CODER_TOOLS_MCP if settings.USE_MCP else CODER_TOOLS_HTTP
QA_TOOLS = QA_TOOLS_MCP if settings.USE_MCP else QA_TOOLS_HTTP
CTO_TOOLS = CTO_TOOLS_MCP if settings.USE_MCP else CTO_TOOLS_HTTP


def get_tools_for_agent(agent_type: str, use_mcp: bool = None) -> list:
    """Get tools for agent type with optional MCP mode override.

    Args:
        agent_type: Agent type ("coder", "qa", "cto")
        use_mcp: Override USE_MCP setting (None = use global setting)

    Returns:
        List of tools for the agent
    """
    use_mcp = use_mcp if use_mcp is not None else settings.USE_MCP

    tool_map = {
        "coder": CODER_TOOLS_MCP if use_mcp else CODER_TOOLS_HTTP,
        "qa": QA_TOOLS_MCP if use_mcp else QA_TOOLS_HTTP,
        "cto": CTO_TOOLS_MCP if use_mcp else CTO_TOOLS_HTTP,
    }

    return tool_map.get(agent_type, [])
