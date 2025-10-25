from typing import Dict, Optional
from asgiref.sync import sync_to_async
from fastmcp import FastMCP

from accounts.models import CustomUser
from pets.models import Pet

# Server configuration
SERVER_NAME = "PETer MCP Server"
SERVER_INSTRUCTIONS = "MCP Server providing tools for the PETer app."

def create_mcp_server() -> FastMCP:

    mcp = FastMCP(name=SERVER_NAME, instructions=SERVER_INSTRUCTIONS)

    @mcp.tool()
    async def get_user_pet_info(user_id: str) -> Dict:
        

        @sync_to_async
        def fetch() -> Dict:
            try:
                # Query for public user profile
                user = CustomUser.objects.filter(
                    id=user_id, 
                    account_privacy='public'
                ).first()

                if not user:
                    return {"error": "User not found or not public."}

                # Get user's pets with related data
                pets = list(Pet.objects.filter(owner=user)
                    .select_related()
                    .prefetch_related(
                        'petphoto_set',
                        'petpost_set',
                        'petcomment_set',
                        'petlike_set'
                    ).values())

                return {
                    "user": user.username,
                    "pets": pets
                }
            except Exception as e:
                raise

        return await fetch()

    return mcp