from typing import Dict, Optional
from asgiref.sync import sync_to_async
from fastmcp import FastMCP

from accounts.models import CustomUser
from pets.models import Pet
from social.apps import SocialConfig
from social.models import PostFrame

# Server configuration
SERVER_NAME = "PETer MCP Server"
SERVER_INSTRUCTIONS = "MCP Server providing tools for the PETer app."

def create_mcp_server() -> FastMCP:

    mcp = FastMCP(name=SERVER_NAME, instructions=SERVER_INSTRUCTIONS)

    @mcp.tool(
        name="get_user_pet_info",
        description="Fetch a public user's basic profile and their pets (including related entities)."
    )
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
    
    @mcp.tool(
        name="get_post_recommendations",
        description="Get up to 3 recommended social posts based on a natural-language content description."
    )
    async def get_post_recommendations(content_description: str) -> list[dict]:
        @sync_to_async
        def fetch() -> list[dict]:
            try:
                recommendation_service = SocialConfig.get_recommendation_service()
                if recommendation_service is None:
                    return {"error": "Recommendation service not available."}

                embedded_description = recommendation_service.embed_content(content_description)
                recommendations = recommendation_service.get_recommendations(embedded_description)
                recommendations = recommendations[:3]  # Limit to top 3 recommendations

                posts = [PostFrame.objects.get(id=post_id) for post_id in recommendations]

                return posts
            except Exception as e:
                raise

        return await fetch()

    return mcp