"""
Run the PETer MCP tools inside the Django process.

Normally the MCP server runs as its own process and Django talks to it over
SSE (http://127.0.0.1:5000/sse). On hosting where only one web app can run
(e.g. DirectAdmin's "Setup Python App"), a second daemon isn't possible, so
the same FastMCP server is created in-memory and called directly - no port,
no network, nothing exposed.

Select with the MCP_TRANSPORT setting / environment variable:
    sse        -> separate MCP server process (default, matches local dev)
    inprocess  -> this module

The tools themselves are unchanged: both paths use mcp_server.server.create_mcp_server().
"""

import logging
from typing import Any

from agents.mcp import MCPServer
from fastmcp import Client
from mcp.types import CallToolResult, GetPromptResult, ListPromptsResult

logger = logging.getLogger(__name__)

_server = None


def get_server():
    """The shared in-memory FastMCP server (created once per process)."""
    global _server
    if _server is None:
        from mcp_server.server import create_mcp_server

        _server = create_mcp_server()
        logger.info("In-process MCP server created")
    return _server


def _to_mcp_result(result) -> CallToolResult:
    """FastMCP's client result -> the mcp.types result the Agents SDK expects."""
    if isinstance(result, CallToolResult):
        return result
    return CallToolResult(
        content=list(getattr(result, "content", []) or []),
        structuredContent=getattr(result, "structured_content", None),
        isError=bool(getattr(result, "is_error", False)),
    )


async def call_tool(tool_name: str, arguments: dict[str, Any] | None = None) -> CallToolResult:
    """Call one MCP tool in-process. Mirrors a remote session.call_tool()."""
    async with Client(get_server()) as client:
        result = await client.call_tool(tool_name, arguments or {}, raise_on_error=False)
    return _to_mcp_result(result)


class InProcessMCPServer(MCPServer):
    """Agents SDK MCP server backed by the in-memory FastMCP instance."""

    def __init__(self, allowed_tool_names: list[str] | None = None, name: str = "PETer MCP Server (in-process)"):
        super().__init__(use_structured_content=False)
        self._name = name
        self._allowed = set(allowed_tool_names) if allowed_tool_names else None

    @property
    def name(self) -> str:
        return self._name

    async def connect(self):  # nothing to connect to
        get_server()

    async def cleanup(self):  # nothing to tear down
        return None

    # The Agents SDK opens servers with "async with mcp_server:". Only the
    # networked subclasses implement that; the abstract MCPServer base does
    # not, so without these the SDK fails with
    #   'InProcessMCPServer' object has no attribute '__aenter__'
    # Note this is the agent path only - call_tool() alone (used by the
    # realtime/voice path) never goes through the context manager, which is
    # why voice worked while chat did not.
    async def __aenter__(self):
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_value, traceback):
        await self.cleanup()
        return False

    async def list_tools(self, run_context=None, agent=None):
        async with Client(get_server()) as client:
            tools = await client.list_tools()
        if self._allowed is not None:
            tools = [t for t in tools if t.name in self._allowed]
        return tools

    async def call_tool(self, tool_name: str, arguments: dict[str, Any] | None = None) -> CallToolResult:
        if self._allowed is not None and tool_name not in self._allowed:
            raise ValueError(f"Tool not allowed: {tool_name}")
        return await call_tool(tool_name, arguments)

    async def list_prompts(self) -> ListPromptsResult:
        async with Client(get_server()) as client:
            prompts = await client.list_prompts()
        return ListPromptsResult(prompts=prompts)

    async def get_prompt(self, name: str, arguments: dict[str, Any] | None = None) -> GetPromptResult:
        async with Client(get_server()) as client:
            return await client.get_prompt(name, arguments or {})
