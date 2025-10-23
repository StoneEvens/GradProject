from typing import Dict, List, Any
from asgiref.sync import sync_to_async
from fastmcp import FastMCP

import requests

server_instructions = """This is a sample MCP server that provides basic tools for demonstration purposes."""

def create_mcp_server():
    server_instructions = """This is a sample MCP server that provides basic tools for demonstration purposes."""
    mcp = FastMCP(name="Sample MCP Server", instructions=server_instructions)

    @mcp.tool()
    async def get_greeting(name: str) -> str:
        """Get a personalized greeting"""
        return f"Hello, {name}!"

    @mcp.tool()
    async def get_user_pet_info(user_id: str):
        from accounts.models import CustomUser
        from pets.models import Pet

        @sync_to_async
        def fetch():
            user = CustomUser.objects.filter(id=user_id, account_privacy='public').first()

            if not user:
                return {"error": "User not found or not public."}

            pets = list(Pet.objects.filter(owner=user).select_related().prefetch_related(
                'petphoto_set',
                'petpost_set',
                'petcomment_set',
                'petlike_set'
            ).values())
            return {"user": user.username, "pets": pets}

        return await fetch()

    return mcp