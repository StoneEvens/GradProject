from typing import Dict, Optional, Literal
import json
import inspect
from typing import get_type_hints, get_origin, get_args
from asgiref.sync import sync_to_async
from fastmcp import FastMCP
import os
import logging

from accounts.models import CustomUser
from pets.models import Pet, DiseaseArchiveContent
from social.models import PostFrame, SoLContent
from utils.recommendation_service import RecommendationService
from social.apps import SocialConfig
from social.serializers import PostFrameSerializer
from pets.serializers import DiseaseArchiveContentSerializer, AbnormalPostSerializer
from feeds.models import Feed
from django.forms.models import model_to_dict
from mcp_server.database_operations import get_operation_list, perform_operation
from mcp_server.entity_resolver import EntityResolver

# Setup logger
logger = logging.getLogger(__name__)

# Server configuration
SERVER_NAME = "PETer MCP Server"
SERVER_INSTRUCTIONS = "MCP Server providing tools for the PETer app."

def create_mcp_server() -> FastMCP:

    mcp = FastMCP(name=SERVER_NAME, instructions=SERVER_INSTRUCTIONS)

    @mcp.tool(
        name="get_user_pet_info_detailed",
        description="Fetch a user's basic profile and their pets (including related entities)."
        "Note that this operation requires verification that the user is performing the operation for themself. The easiest way to ensure this is to check the target of the prompt matches the user ID of the requester. The user id was added to the prompt automatically by the backend."
    )
    async def get_user_pet_info_detailed(user_id: int) -> str:
        """Returns a JSON string with user and pet information, or error message."""
        logger.info(f"[MCP Tool] get_user_pet_info_detailed called with user_id={user_id}")
        
        @sync_to_async
        def fetch() -> Dict:
            try:
                logger.info(f"[MCP Tool] Fetching user with id={user_id}")
                user = CustomUser.objects.filter(
                    id=user_id
                ).first()

                if not user:
                    logger.warning(f"[MCP Tool] User {user_id} not found")
                    return {"error": f"User with ID {user_id} not found."}

                logger.info(f"[MCP Tool] Found user: {user.username}")
                
                # Get user's pets with related data (keep model instances to access relations)
                pets_qs = (Pet.objects
                           .filter(owner=user)
                           .select_related()
                           .prefetch_related('abnormal_posts'))

                pets_data: list[dict] = []
                all_abnormal_posts_data: list[dict] = []
                
                logger.info(f"[MCP Tool] Processing {pets_qs.count()} pets")
                
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

                result = {
                    "success": True,
                    "user": user.username,
                    "user_id": user_id,
                    "pets": pets_data,
                    "abnormal_posts": all_abnormal_posts_data
                }
                
                logger.info(f"[MCP Tool] Successfully fetched data for user {user.username}: {len(pets_data)} pets, {len(all_abnormal_posts_data)} abnormal posts")
                return result
                
            except Exception as e:
                logger.error(f"[MCP Tool] Error in get_user_pet_info_detailed: {type(e).__name__}: {str(e)}", exc_info=True)
                return {
                    "success": False,
                    "error": f"{type(e).__name__}: {str(e)}"
                }

        result_dict = await fetch()
        # Return as JSON string for the agent
        result_json = json.dumps(result_dict, ensure_ascii=False, indent=2)
        logger.info(f"[MCP Tool] Returning result (length: {len(result_json)} chars)")
        return result_json
    
    @mcp.tool(
        name="get_user_pet_list",
        description="Fetch a user's list of pets."
    )
    async def get_user_pet_list(user_id: int) -> str:
        @sync_to_async
        def fetch() -> Dict:
            try:
                user = CustomUser.objects.filter(
                    id=user_id
                ).first()

                if not user:
                    return {"error": "User not found."}

                pets_qs = Pet.objects.filter(owner=user)

                pets_data: list[dict] = []
                for pet in pets_qs:
                    pets_data.append({
                        'id': pet.id,
                        'name': pet.pet_name,
                        'type': pet.pet_type,
                        'breed': pet.breed,
                        'age': pet.age,
                        'weight': pet.weight,
                    })

                # Ensure JSON-serializable primitives
                pets_data = json.loads(json.dumps(pets_data, default=str))

                return {
                    "success": True,
                    "user": user.username,
                    "user_id": user_id,
                    "pets": pets_data
                }
            except Exception as e:
                return {"error": f"Failed to fetch pet list: {str(e)}"}

        result_dict = await fetch()
        return json.dumps(result_dict, ensure_ascii=False, indent=2)
    
    @mcp.tool(
        name="get_post_recommendations",
        description="Get recommended social posts based on a natural-language content description. Please use keywords; vague descriptions may yield poor results. Fetch both social and forum posts if no specific instruction was given."
        "You can also use this tool to get the posts related to specific pet type, then use the result to filter such pet type owned by users."
    )
    async def get_post_recommendations(content_description: str, hashtags: list[str], isSocial: bool, isForum: bool) -> str:
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
                    top_post_ids = recommended_post_ids[:3]

                    posts = PostFrame.get_postFrames(idList=top_post_ids)
                    serializer = PostFrameSerializer(posts, many=True)
                    posts_data += json.loads(json.dumps(serializer.data, default=str))

                if (isForum):
                    recommended_post_ids = recommendation_service.recommend_posts(user_vec=embedded_description, content_type='forum')
                    top_post_ids = recommended_post_ids[:3]

                    archives = DiseaseArchiveContent.get_content(ids=top_post_ids)
                    serializer = DiseaseArchiveContentSerializer(archives, many=True)
                    posts_data += json.loads(json.dumps(serializer.data, default=str))

                for post in posts_data:
                    print(f"Recommended Post ID: {post.get('id')} Title: {post.get('title')}")

                return posts_data
            except Exception as e:
                return [{"error": f"Failed to get recommendations: {str(e)}"}]

        result = await fetch()
        return json.dumps(result, ensure_ascii=False, indent=2)
    
    @mcp.tool(
        name="get_user_information",
        description="Fetch basic information of a user by their user ID."
    )
    async def get_user_information(user_ids: list[int]) -> str:
        @sync_to_async
        def fetch() -> Dict:
            try:
                users_info: Dict[int, Dict] = {}
                # Fetch only public users to avoid leaking private profile data
                users = CustomUser.objects.filter(id__in=user_ids, account_privacy='public')

                for user in users:
                    # Build a rich, serialization-safe user dict (exclude sensitive fields like password, email)
                    data: Dict[str, Optional[str]] = {
                        "id": user.id,
                        "username": getattr(user, 'username', None),
                        "user_account": getattr(user, 'user_account', None),
                        "user_fullname": getattr(user, 'user_fullname', None),
                        "user_intro": getattr(user, 'user_intro', None),
                        "account_privacy": getattr(user, 'account_privacy', None),
                    }
                    # Optional avatar/headshot URL if present
                    headshot = getattr(user, 'headshot', None)
                    if headshot and getattr(headshot, 'url', None):
                        data["headshot_url"] = headshot.url
                    # Optional timestamps if model has them
                    if hasattr(user, 'date_joined'):
                        data['date_joined'] = str(user.date_joined)
                    if hasattr(user, 'last_login') and user.last_login:
                        data['last_login'] = str(user.last_login)

                    users_info[user.id] = data

                return {
                    "users": users_info,
                    "requested_ids": user_ids,
                    "found_ids": list(users_info.keys())
                }
            except Exception as e:
                return {"error": f"Failed to fetch user information: {str(e)}"}

        result_dict = await fetch()
        return json.dumps(result_dict, ensure_ascii=False, indent=2)
    
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
                    pet_types[user.id] = [pet.pet_type for pet in pets]

                return {"pet_types": pet_types}
            except Exception as e:
                return {"error": f"Failed to fetch user pet types: {str(e)}"}

        result_dict = await fetch()
        return json.dumps(result_dict, ensure_ascii=False, indent=2)
    
    @mcp.tool(
        name="get_pet_foods_details",
        description="Fetch detailed information about pet foods"
    )
    async def get_pet_foods_details() -> str:
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

        result = await fetch()
        return json.dumps(result, ensure_ascii=False, indent=2)

    @mcp.tool(
        name="list_available_tools",
        description="List all available MCP tools exposed by this server."
    )
    async def list_available_tools() -> list[dict]:
        @sync_to_async
        def fetch() -> list[dict]:
            try:
                def type_to_str(tp) -> str:
                    try:
                        if tp is inspect._empty:
                            return "unknown"
                        origin = get_origin(tp)
                        if origin is None:
                            return getattr(tp, "__name__", str(tp))
                        args = ", ".join(type_to_str(a) for a in get_args(tp))
                        return f"{getattr(origin, '__name__', str(origin))}[{args}]"
                    except Exception:
                        return str(tp)

                def params_of(func) -> list[dict]:
                    try:
                        sig = inspect.signature(func)
                        hints = {}
                        try:
                            hints = get_type_hints(func)
                        except Exception:
                            pass
                        out = []
                        for name, p in sig.parameters.items():
                            if name in ("self", "cls"):
                                continue
                            ann = hints.get(name, p.annotation)
                            entry = {
                                "name": name,
                                "type": type_to_str(ann),
                                "required": p.default is inspect._empty,
                            }
                            if p.default is not inspect._empty:
                                entry["default"] = str(p.default)
                            out.append(entry)
                        return out
                    except Exception:
                        return []

                items: list[dict] = []
                tools = getattr(mcp, "tools", None) or getattr(mcp, "_tools", None)
                if isinstance(tools, dict):
                    for t in tools.values():
                        # Try to resolve underlying callable and metadata
                        fn = getattr(t, "fn", None) or getattr(t, "func", None) or getattr(t, "__call__", None) or t
                        name = getattr(t, "name", None) or getattr(fn, "__name__", None) or "unknown"
                        desc = getattr(t, "description", None) or getattr(fn, "__doc__", "")
                        items.append({
                            "name": name,
                            "description": str(desc) if desc else "",
                            "parameters": params_of(fn)
                        })
                else:
                    # Fallback: static list in case reflection is unavailable
                    static = [
                        {"name": "get_user_pet_info_detailed", "description": "Fetch a public user's profile and pets with abnormal posts.", "parameters": [{"name": "user_id", "type": "int", "required": True}]},
                        {"name": "get_post_recommendations", "description": "Get recommended social/forum posts by description and hashtags.", "parameters": [{"name": "content_description", "type": "str", "required": True}, {"name": "hashtags", "type": "list[str]", "required": True}, {"name": "isSocial", "type": "bool", "required": True}, {"name": "isForum", "type": "bool", "required": True}]},
                        {"name": "get_user_information", "description": "Fetch basic information of users by their IDs.", "parameters": [{"name": "user_ids", "type": "list[int]", "required": True}]},
                        {"name": "get_user_pet_types", "description": "Fetch the types of pets owned by users.", "parameters": [{"name": "user_ids", "type": "list[int]", "required": True}]},
                        {"name": "get_pet_foods_details", "description": "Fetch detailed information about pet foods.", "parameters": []}
                    ]
                    items = static

                return json.loads(json.dumps(items, default=str))
            except Exception as e:
                return [{"error": f"Failed to list tools: {str(e)}"}]

        return await fetch()

    @mcp.tool(
        name="list_tutorial_topics",
        description="List available tutorial topics for users as an id->description mapping."
    )
    async def list_tutorial_topics() -> str:
        @sync_to_async
        def fetch() -> Dict[str, str]:
            try:
                # Return values aligned with frontend tutorialOptionsMap.json
                topics_map: Dict[str, str] = {
                    "tagPet": "學習如何在照片中標記您的寵物",
                    "createPost": "學習如何創建和發布貼文",
                    "calculate": "學習如何使用計算機計算寵物一天所需攝取之飼料量",
                    "addAbnormalPost": "學習如何新增一篇異常記錄",
                    "addPet": "學習如何將您的寵物新增到系統裡"
                }
                return json.loads(json.dumps(topics_map, ensure_ascii=False))
            except Exception as e:
                return {"error": f"Failed to list tutorial topics: {str(e)}"}

        result_dict = await fetch()
        return json.dumps(result_dict, ensure_ascii=False, indent=2)

    @mcp.tool(
        name="get_navigation_paths",
        description="Get all available page paths and their mappings. Use this to find the correct path for user navigation requests."
    )
    async def get_navigation_paths() -> str:
        """
        返回所有可用的頁面路徑和對應的關鍵字映射

        Returns:
        {
            "available_paths": [
                {
                    "path": "/social",
                    "name": "社群頁面",
                    "keywords": ["社群", "社交", "貼文"],
                    "description": "查看和發布社群貼文"
                },
                ...
            ],
            "dynamic_paths": [...]
        }
        """
        try:
            # 讀取 navigation_paths.json
            current_dir = os.path.dirname(__file__)
            json_path = os.path.join(current_dir, 'navigation_paths.json')

            with open(json_path, 'r', encoding='utf-8') as f:
                paths_data = json.load(f)

            return json.dumps(paths_data, ensure_ascii=False, indent=2)
        except Exception as e:
            result = {
                "error": f"Failed to load navigation paths: {str(e)}",
                "available_paths": [],
                "dynamic_paths": []
            }
            return json.dumps(result, ensure_ascii=False, indent=2)

    @mcp.tool(
        name="prepare_navigate",
        description="Prepare a page navigation operation that requires user confirmation. Call get_navigation_paths first to find the correct path."
    )
    async def prepare_navigate(
        path: str,
        reason: Optional[str] = None
    ) -> str:
        import uuid
        from datetime import datetime, timezone, timedelta

        # 路徑對應的友善名稱
        path_names = {
            "/social": "社群頁面",
            "/pets": "寵物列表",
            "/profile": "個人檔案",
            "/calculator": "營養計算機",
            "/health": "健康記錄",
            "/schedule": "餵食排程",
            "/interactive-city": "互動城市"
        }

        # 處理動態路徑
        friendly_name = path_names.get(path)
        if not friendly_name:
            if path.startswith("/pets/"):
                friendly_name = "寵物詳情頁面"
            elif path.startswith("/user/"):
                friendly_name = "用戶檔案頁面"
            elif path.startswith("/disease-archive/"):
                friendly_name = "疾病檔案頁面"
            else:
                friendly_name = path

        operation_id = f"nav_{uuid.uuid4().hex[:12]}"
        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()

        confirmation_msg = f"確認要前往「{friendly_name}」嗎？"
        if reason:
            confirmation_msg += f"\n\n{reason}"

        result = {
            "operation_id": operation_id,
            "type": "navigate",
            "params": {
                "path": path
            },
            "confirmation_message": confirmation_msg,
            "preview": {
                "destination": friendly_name,
                "path": path,
                "reason": reason or "用戶要求前往此頁面"
            },
            "requires_confirmation": True,
            "expires_at": expires_at
        }
        
        return json.dumps(result, ensure_ascii=False, indent=2)
    
    @mcp.tool(
        name="database_operation_list",
        description="List available database operations as well as the parameters required."
    )
    async def database_operation_list() -> str:
        @sync_to_async
        def fetch() -> Dict:
            return get_operation_list()

        result_dict = await fetch()
        return json.dumps(result_dict, ensure_ascii=False, indent=2)

    @mcp.tool(
        name="perform_database_operation",
        description="Perform a database operation such as managing pet information, abnormal posts, disease archives, user plans/schedules, or creating social posts. Use database_operation_list tool to see all available operations and their required parameters."
        "Note that database operations affects personal data; please verify that the user is doing the operation for themself. The easiest way to ensure this is to check the target of the prompt matches the user ID of the requester. The user id was added to the prompt automatically by the backend."
    )
    async def perform_database_operation(
        operation: Literal["add_pet", "update_pet", "add_abnormal_post", "update_abnormal_post", "delete_abnormal_post", "create_disease_archive", "add_plan", "update_plan", "delete_plan", "list_plans", "create_social_post"],
        data: Dict
    ) -> str:
        @sync_to_async
        def execute() -> Dict:
            return perform_operation(operation, data)

        result_dict = await execute()
        return json.dumps(result_dict, ensure_ascii=False, indent=2)

    @mcp.tool(
        name="resolve_entity_context",
        description="""
        Resolve dynamic path parameters by finding entities based on natural language descriptions.

        This is a UNIVERSAL tool for handling dynamic paths that require IDs.

        Supported entity types:
        - social_post: User's social posts (for /post/{id}/edit, etc.)
        - feed: Pet food products (for /feeds/{id})
        - pet: User's pets (for /pet/{id}/edit, /pet/{id}/health-reports, etc.)
        - user: Other users (for /user/{username})
        - health_report: Health reports (for /pet/{petId}/health-report/{id})
        - disease_archive: Disease archives (for /pet/{petId}/disease-archive/{id})
        - abnormal_post: Abnormal records (for /pet/{petId}/abnormal-post/{id})

        Common conditions patterns:
        - time_range: "today", "yesterday", "last_week", "last_month", "last_sunday"
        - specific_date: "2025-11-03"
        - keywords: ["keyword1", "keyword2"]
        - pet_name: "pet name"
        - newest: true (get most recent)
        - oldest: true (get earliest)

        Returns matching entities with their IDs and resolved paths.
        """
    )
    async def resolve_entity_context(
        entity_type: Literal["social_post", "feed", "pet", "user", "health_report", "disease_archive", "abnormal_post"],
        user_id: int,
        conditions: Dict,
        limit: int = 5
    ) -> Dict:
        """
        統一的動態路徑參數解析工具

        Examples:

        1. "幫我跳轉到上禮拜天發的貼文編輯頁面"
           - entity_type: "social_post"
           - conditions: {"time_range": "last_sunday"}

        2. "前往我最後查看的飼料頁面"
           - entity_type: "feed"
           - conditions: {"usage": "last_viewed"}

        3. "帶我去我第一隻寵物的健康報告"
           - entity_type: "pet"
           - conditions: {"oldest": true}
           - Then use pet_id to query health_report
        """
        return await EntityResolver.resolve(entity_type, user_id, conditions, limit)

    return mcp