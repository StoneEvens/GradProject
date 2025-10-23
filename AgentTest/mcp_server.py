from typing import Dict, List, Any

from fastmcp import FastMCP

import requests

server_instructions = """This is a sample MCP server that provides basic tools for demonstration purposes."""

def create_mcp_server():
    mcp = FastMCP(name="Sample MCP Server", instructions=server_instructions)

    @mcp.tool()
    async def get_greeting(name: str) -> str:
        """Get a personalized greeting"""
        return f"Hello, {name}!"

    @mcp.tool()
    async def get_user_pet_info(user_id: str) -> Dict[str, Any]:
        """Fetch user pet information from a mock database"""
        mock_db = {
            "1": {"pet_name": "Buddy", "pet_type": "Dog"},
            "2": {"pet_name": "Mittens", "pet_type": "Cat"},
        }

        return mock_db.get(user_id, {"error": "User not found"})
    

    return mcp

def main():
    mcp_server = create_mcp_server()
    
    try:
        mcp_server.run(transport="sse", host="0.0.0.0", port=5000)
    except Exception as e:
        raise ValueError(f"Server error: {e}")
    
if __name__ == "__main__":
    main()