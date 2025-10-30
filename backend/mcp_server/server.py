from typing import Dict, Optional
import json
from asgiref.sync import sync_to_async
from fastmcp import FastMCP

from accounts.models import CustomUser
from pets.models import Pet, DiseaseArchiveContent
from social.models import PostFrame, SoLContent
from utils.recommendation_service import RecommendationService
from social.apps import SocialConfig
from social.serializers import PostFrameSerializer
from pets.serializers import DiseaseArchiveContentSerializer, AbnormalPostSerializer
from feeds.models import Feed
from django.forms.models import model_to_dict

# Server configuration
SERVER_NAME = "PETer MCP Server"
SERVER_INSTRUCTIONS = "MCP Server providing tools for the PETer app."

def create_mcp_server() -> FastMCP:

    mcp = FastMCP(name=SERVER_NAME, instructions=SERVER_INSTRUCTIONS)

    @mcp.tool(
        name="get_user_pet_info_detailed",
        description="Fetch a public user's basic profile and their pets (including related entities)."
    )
    async def get_user_pet_info_detailed(user_id: int) -> Dict:
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

                # Get user's pets with related data (keep model instances to access relations)
                pets_qs = (Pet.objects
                           .filter(owner=user)
                           .select_related()
                           .prefetch_related('abnormal_posts'))

                pets_data: list[dict] = []
                all_abnormal_posts_data: list[dict] = []
                for pet in pets_qs:
                    pet_dict = model_to_dict(pet)
                    # Serialize related abnormal posts (prefetched)
                    abnormal_list = list(getattr(pet, 'abnormal_posts').all())
                    abnormal_ser = AbnormalPostSerializer(abnormal_list, many=True)
                    abnormal_data = json.loads(json.dumps(abnormal_ser.data, default=str))
                    pet_dict['abnormal_posts'] = abnormal_data
                    pets_data.append(pet_dict)
                    all_abnormal_posts_data.extend(abnormal_data)

                # Ensure JSON-serializable primitives
                pets_data = json.loads(json.dumps(pets_data, default=str))

                return {
                    "user": user.username,
                    "pets": pets_data,
                    "abnormal_posts": all_abnormal_posts_data
                }
            except Exception as e:
                raise

        return await fetch()
    
    @mcp.tool(
        name="get_post_recommendations",
        description="Get recommended social posts based on a natural-language content description. Please use keywords; vague descriptions may yield poor results. Fetch both social and forum posts on default."
    )
    async def get_post_recommendations(content_description: str, hashtags: list[str], isSocial: bool, isForum: bool) -> list[dict]:
        @sync_to_async
        def fetch() -> list[dict]:
            try:
                posts_data: list[dict] = []

                recommendation_service = SocialConfig.get_recommendation_service()
                if recommendation_service is None:
                    return [{"error": "Recommendation service not available."}]

                embedded_description = recommendation_service.embed_content(content_description, hashtags=hashtags)

                if (isSocial):
                    recommended_post_ids = recommendation_service.recommend_posts(user_vec=embedded_description, content_type='social')
                    top_post_ids = recommended_post_ids[:5]

                    posts = PostFrame.get_postFrames(idList=top_post_ids)
                    serializer = PostFrameSerializer(posts, many=True)
                    posts_data += json.loads(json.dumps(serializer.data, default=str))

                if (isForum):
                    recommended_post_ids = recommendation_service.recommend_posts(user_vec=embedded_description, content_type='forum')
                    top_post_ids = recommended_post_ids[:5]

                    archives = DiseaseArchiveContent.get_content(ids=top_post_ids)
                    serializer = DiseaseArchiveContentSerializer(archives, many=True)
                    posts_data += json.loads(json.dumps(serializer.data, default=str))

                return posts_data
            except Exception as e:
                return [{"error": f"Failed to get recommendations: {str(e)}"}]

        return await fetch()
    
    @mcp.tool(
        name="get_user_information",
        description="Fetch basic information of a user by their user ID."
    )
    async def get_user_information(user_ids: list[int]) -> Dict:
        @sync_to_async
        def fetch() -> Dict:
            try:
                users_info: Dict[int, Dict] = {}
                users = CustomUser.objects.filter(id__in=user_ids, account_privacy='public')

                for user in users:
                    users_info[user.id] = {
                        "username": user.username,
                        "user_intro": user.user_intro,
                        "user_fullname": user.user_fullname,
                        "user_account": user.user_account,
                    }

                return users_info
            except Exception as e:
                return {"error": f"Failed to fetch user information: {str(e)}"}

        return await fetch()
    
    @mcp.tool(
        name="get_user_pet_types",
        description="Fetch the types of pets owned by a user."
    )
    async def get_user_pet_types(user_ids: list[int]) -> Dict:
        @sync_to_async
        def fetch() -> Dict:
            try:
                users = CustomUser.objects.filter(id__in=user_ids)
                if not users:
                    return {"error": "Users not found."}

                pet_types = {}
                for user in users:
                    pets = Pet.objects.filter(owner=user)
                    pet_types[user.id] = [pet.type for pet in pets]

                return {"pet_types": pet_types}
            except Exception as e:
                return {"error": f"Failed to fetch user pet types: {str(e)}"}

        return await fetch()
    
    @mcp.tool(
        name="get_pet_foods_details",
        description="Fetch detailed information about pet foods"
    )
    async def get_pet_foods_details() -> list[dict]:
        @sync_to_async
        def fetch() -> list[dict]:
            try:
                pet_foods = Feed.objects.all().prefetch_related("ratings")
                pet_foods_data: list[dict] = []
                for food in pet_foods:
                    food_dict = model_to_dict(food)
                    pet_foods_data.append(food_dict)
                # Ensure plain list[dict] with JSON-serializable primitives
                return json.loads(json.dumps(pet_foods_data, default=str))
            except Exception as e:
                return [{"error": f"Failed to fetch pet foods details: {str(e)}"}]

        return await fetch()

    return mcp