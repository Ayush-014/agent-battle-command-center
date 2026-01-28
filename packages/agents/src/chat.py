"""Chat endpoint for direct agent communication with SSE streaming."""
import json
import httpx
from typing import AsyncGenerator, Literal
from pydantic import BaseModel
from anthropic import Anthropic

from src.config import settings


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    agent_type: Literal["coder", "qa"]
    messages: list[ChatMessage]
    stream: bool = True
    task_context: str | None = None
    use_ollama: bool = True  # Default to Ollama for testing


class ChatResponse(BaseModel):
    content: str
    model: str


AGENT_SYSTEM_PROMPTS = {
    "coder": """You are a senior software engineer AI assistant. You help with:
- Writing clean, maintainable code
- Debugging and fixing issues
- Code reviews and improvements
- Architecture decisions
- Best practices and patterns

You provide clear, concise responses with code examples when helpful.
Keep responses focused and actionable.""",

    "qa": """You are a QA engineer AI assistant. You help with:
- Writing test cases and test plans
- Identifying edge cases and potential bugs
- Code review from a quality perspective
- Test automation strategies
- Quality metrics and best practices

You focus on ensuring software quality and reliability.""",
}


def get_anthropic_client() -> Anthropic:
    """Get Anthropic client instance."""
    if not settings.ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY is not set")
    return Anthropic(api_key=settings.ANTHROPIC_API_KEY)


def build_system_prompt(agent_type: str, task_context: str | None = None) -> str:
    """Build the system prompt for the agent."""
    base_prompt = AGENT_SYSTEM_PROMPTS.get(agent_type, AGENT_SYSTEM_PROMPTS["coder"])

    if task_context:
        return f"{base_prompt}\n\nCurrent Task Context:\n{task_context}"

    return base_prompt


async def chat_stream_ollama(request: ChatRequest) -> AsyncGenerator[str, None]:
    """Stream chat response from Ollama using SSE format."""
    system_prompt = build_system_prompt(request.agent_type, request.task_context)

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend([{"role": msg.role, "content": msg.content} for msg in request.messages])

    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream(
            "POST",
            f"{settings.OLLAMA_URL}/api/chat",
            json={
                "model": settings.OLLAMA_MODEL,
                "messages": messages,
                "stream": True,
            },
        ) as response:
            async for line in response.aiter_lines():
                if line:
                    try:
                        data = json.loads(line)
                        if "message" in data and "content" in data["message"]:
                            chunk = data["message"]["content"]
                            if chunk:
                                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
                        if data.get("done", False):
                            yield f"data: {json.dumps({'done': True})}\n\n"
                    except json.JSONDecodeError:
                        continue


async def chat_stream_claude(request: ChatRequest) -> AsyncGenerator[str, None]:
    """Stream chat response from Claude using SSE format."""
    client = get_anthropic_client()

    system_prompt = build_system_prompt(request.agent_type, request.task_context)

    messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]

    with client.messages.stream(
        model=settings.DEFAULT_MODEL,
        max_tokens=4096,
        system=system_prompt,
        messages=messages,
    ) as stream:
        for text in stream.text_stream:
            yield f"data: {json.dumps({'chunk': text})}\n\n"

    yield f"data: {json.dumps({'done': True})}\n\n"


async def chat_stream(request: ChatRequest) -> AsyncGenerator[str, None]:
    """Stream chat response using SSE format."""
    if request.use_ollama:
        async for chunk in chat_stream_ollama(request):
            yield chunk
    else:
        async for chunk in chat_stream_claude(request):
            yield chunk


def chat_sync(request: ChatRequest) -> ChatResponse:
    """Synchronous chat for non-streaming requests."""
    if request.use_ollama:
        return chat_sync_ollama(request)
    else:
        return chat_sync_claude(request)


def chat_sync_ollama(request: ChatRequest) -> ChatResponse:
    """Synchronous chat with Ollama."""
    system_prompt = build_system_prompt(request.agent_type, request.task_context)

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend([{"role": msg.role, "content": msg.content} for msg in request.messages])

    response = httpx.post(
        f"{settings.OLLAMA_URL}/api/chat",
        json={
            "model": settings.OLLAMA_MODEL,
            "messages": messages,
            "stream": False,
        },
        timeout=120.0,
    )

    data = response.json()
    content = data.get("message", {}).get("content", "")

    return ChatResponse(content=content, model=settings.OLLAMA_MODEL)


def chat_sync_claude(request: ChatRequest) -> ChatResponse:
    """Synchronous chat with Claude."""
    client = get_anthropic_client()

    system_prompt = build_system_prompt(request.agent_type, request.task_context)

    messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]

    response = client.messages.create(
        model=settings.DEFAULT_MODEL,
        max_tokens=4096,
        system=system_prompt,
        messages=messages,
    )

    content = response.content[0].text if response.content else ""

    return ChatResponse(content=content, model=settings.DEFAULT_MODEL)
