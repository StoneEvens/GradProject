from typing import Dict, Optional
import json
from asgiref.sync import sync_to_async
from fastmcp import FastMCP

from accounts.models import CustomUser
from pets.models import Pet
from social.models import PostFrame, SoLContent
from utils.recommendation_service import RecommendationService
from social.apps import SocialConfig
from social.serializers import PostFrameSerializer

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
        description="Get recommended social posts based on a natural-language content description. Please use keywords; vague descriptions may yield poor results."
    )
    async def get_post_recommendations(content_description: str, hashtags: list[str]) -> list[dict]:
        @sync_to_async
        def fetch() -> list[dict]:
            try:
                recommendation_service = SocialConfig.get_recommendation_service()
                if recommendation_service is None:
                    return [{"error": "Recommendation service not available."}]

                embedded_description = recommendation_service.embed_content(content_description, hashtags=hashtags)
                recommended_post_ids = recommendation_service.recommend_posts(user_vec=embedded_description, content_type='social')
                top_post_ids = recommended_post_ids[:5]

                posts = PostFrame.get_postFrames(idList=top_post_ids)

                serializer = PostFrameSerializer(posts, many=True)
                # Ensure a plain built-in list[dict] (not DRF ReturnList/ReturnDict)
                # Also stringify non-JSON-serializable types (e.g., datetimes) via default=str
                posts_data: list[dict] = json.loads(json.dumps(serializer.data, default=str))

                return posts_data
            except Exception as e:
                return [{"error": f"Failed to get recommendations: {str(e)}"}]

        return await fetch()

    return mcp