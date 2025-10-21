import logging
import os
from typing import Dict, List, Any

from fastmcp import FastMCP
from openai import OpenAI

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
openai_client = OpenAI()

server_instructions = """This is a sample MCP server that provides basic tools for demonstration purposes."""

def create_mcp_server():
    mcp = FastMCP(name="Sample MCP Server", instructions=server_instructions)

    @mcp.tool()
    async def get_greeting(name: str) -> str:
        """Get a personalized greeting"""
        return f"Hello, {name}!"
    
    return mcp

def main():
    if not openai_client:
        raise ValueError("OpenAI API key is required")
    
    server = create_mcp_server()

    try:
        # Use FastMCP's built-in run method with SSE transport
        server.run(transport="sse", host="0.0.0.0", port=5000)
    except Exception as e:
        raise ValueError(f"Server error: {e}")
    
if __name__ == "__main__":
    main()