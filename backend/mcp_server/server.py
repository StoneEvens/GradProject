from typing import Dict, Optional, Literal, Any
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
from mcp_server.database_operations import get_operation_list, get_operation_list_summary, get_operation_usage, perform_operation
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
        description=(
            "Fetch a user's profile and their pets with abnormal posts.\n"
            "USE WHEN: User asks about their pets, pet health history, or abnormal records.\n"
            "NOTE: Verify requester_user_id matches the requested user_id.\n"
            "RETURNS: User info + list of pets with their abnormal_posts arrays."
        )
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
        description=(
            "Fetch a user's list of pets (basic info only, no health records).\n"
            "USE WHEN: Need pet names/types/breeds without health data.\n"
            "RETURNS: List of {id, name, type, breed, age, weight}."
        )
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
        description=(
            "Get recommended social/forum posts based on content keywords.\n"
            "USE WHEN: User wants post recommendations or searches for specific topics to find users relevant to the topic.\n"
            "PARAMS: Use clear description of content and relevant hashtags; set isSocial/isForum flags, get both on default if not specified.\n"
            "RETURNS: List of posts → populate recommended_social_posts or recommended_forum_posts."
        )
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
        description=(
            "Fetch public profile info for specified user IDs.\n"
            "USE WHEN: Need info about OTHER users (not the requester).\n"
            "RETURNS: {users: {id: {username, user_fullname, user_intro, headshot_url}}}."
        )
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
        description=(
            "Fetch pet types (dog/cat/etc.) owned by specified users.\n"
            "USE WHEN: Need to filter or match users by pet type.\n"
            "RETURNS: {pet_types: {user_id: ['dog', 'cat', ...]}}."
        )
    )
    async def get_user_pet_types(user_ids: list[int]) -> str:
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
        description=(
            "Fetch all pet foods from database with nutrition info.\n"
            "USE WHEN: User asks about feed/food comparison or nutrition.\n"
            "RETURNS: List of feeds with protein, fat, carbs, minerals, etc."
        )
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
        name="list_tutorial_topics",
        description=(
            "List available interactive tutorial topics.\n"
            "USE WHEN: User asks how to do something or wants to learn a feature.\n"
            "RETURNS: {id: description} mapping → set matching id in 'tutorial' field."
        )
    )
    async def list_tutorial_topics() -> str:
        @sync_to_async
        def fetch() -> Dict[str, str]:
            try:
                # Return values aligned with frontend tutorialOptionsMap.json
                topics_map: Dict[str, str] = {
                    "tagPet": "學習如何標註寵物",
                    "createPost": "學習如何建立發布貼文",
                    "calculate": "學習如何使用計算機計算寵物天數及餵食量",
                    "addAbnormalPost": "學習如何新增一篇異常貼文",
                    "addPet": "學習如何將您的寵物新增到系統中"
                }
                return json.loads(json.dumps(topics_map, ensure_ascii=False))
            except Exception as e:
                return {"error": f"Failed to list tutorial topics: {str(e)}"}

        result_dict = await fetch()
        return json.dumps(result_dict, ensure_ascii=False, indent=2)

    @mcp.tool(
        name="get_navigation_paths",
        description=(
            "Get all valid page paths and their friendly names.\n"
            "USE WHEN: Need to find correct path before calling prepare_navigate.\n"
            "RETURNS: {available_paths: [...], dynamic_paths: [...]}."
        )
    )
    async def get_navigation_paths() -> str:
        try:
            # 讀??navigation_paths.json
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
        description=(
            "Prepare navigation to a page (returns operation for frontend).\n"
            "USE WHEN: User wants to go to a specific page.\n"
            "PREREQ: Call get_navigation_paths first to get valid path.\n"
            "RETURNS: Operation object → add to 'operations' array."
        )
    )
    async def prepare_navigate(
        path: str,
        reason: Optional[str] = None
    ) -> str:
        import uuid
        from datetime import datetime, timezone, timedelta
        import re

        # 從 navigation_paths.json 讀取路徑資訊
        current_dir = os.path.dirname(__file__)
        json_path = os.path.join(current_dir, 'navigation_paths.json')

        friendly_name = None

        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                paths_data = json.load(f)

            # 先嘗試匹配靜態路徑（available_paths）
            for path_info in paths_data.get('available_paths', []):
                if path_info['path'] == path:
                    friendly_name = path_info['name']
                    break

            # 如果沒找到，嘗試匹配動態路徑（dynamic_paths）
            if not friendly_name:
                for path_info in paths_data.get('dynamic_paths', []):
                    pattern = path_info['pattern']
                    # 將路徑模式轉換為正則表達式
                    # 例如 /pet/{petId}/edit -> ^/pet/[^/?]+/edit$
                    # /social?q={query} -> ^/social\?q=.+$
                    regex_pattern = re.escape(pattern)
                    # 替換轉義後的佔位符為正則模式
                    regex_pattern = re.sub(r'\\\{[^}]+\\\}', r'[^/?]+', regex_pattern)
                    regex_pattern = f"^{regex_pattern}$"

                    if re.match(regex_pattern, path):
                        friendly_name = path_info['name']
                        break
        except Exception as e:
            logger.warning(f"Failed to load navigation paths: {e}")

        # 如果還是沒找到，使用路徑本身作為顯示名稱
        if not friendly_name:
            friendly_name = path

        operation_id = f"nav_{uuid.uuid4().hex[:12]}"
        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()

        confirmation_msg = f"確定要前往{friendly_name}嗎？"
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
                "reason": reason or "用戶要導航到此頁面"
            },
            "requires_confirmation": True,
            "expires_at": expires_at
        }

        return json.dumps(result, ensure_ascii=False, indent=2)
    
    @mcp.tool(
        name="database_operation_list",
        description=(
            "List all database operations with brief summary (names + params).\n"
            "USE WHEN: Need to know what operations are available.\n"
            "RETURNS: {operations: {name: {description, required_params, optional_params}}}.\n"
            "NEXT: Call get_operation_usage(operation_name) to get full details before perform_database_operation."
        )
    )
    async def database_operation_list() -> str:
        @sync_to_async
        def fetch() -> Dict:
            return get_operation_list_summary()

        result_dict = await fetch()
        return json.dumps(result_dict, ensure_ascii=False, indent=2)

    @mcp.tool(
        name="get_operation_usage",
        description=(
            "Get full details for a specific database operation.\n"
            "USE WHEN: About to call perform_database_operation - MUST call this first.\n"
            "RETURNS: Complete param_details, notes, workflow, response_handling, user_responses.\n"
            "This tells you exactly what to ask the user and how to handle the response."
        )
    )
    async def get_operation_usage_tool(operation: str) -> str:
        @sync_to_async
        def fetch() -> Dict:
            return get_operation_usage(operation)

        result_dict = await fetch()
        return json.dumps(result_dict, ensure_ascii=False, indent=2)

    @mcp.tool(
        name="prepare_feed_ocr",
        description=(
            "Trigger OCR for feed nutrition label images.\n"
            "USE WHEN: User uploads 2 images (package + nutrition label) for feed analysis.\n"
            "PREREQ: hasImages=true AND imageCount>=2.\n"
            "RETURNS: Operation object → add {operation_type: 'ocr_feed_analysis', operation_data: json.dumps({purpose: 'feed_nutrition'})} to 'operations'.\n"
            "NEXT: Tell user '收到圖片！正在辨識飼料資訊，請稍候...' and wait for OCR results."
        )
    )
    async def prepare_feed_ocr(
        reason: str = "辨識飼料資訊"
    ) -> str:
        """
        Returns an operation instruction for frontend to execute feed OCR analysis.

        Args:
            reason: Analysis reason (displayed to user)

        Returns:
            JSON string with operation details
        """
        from datetime import datetime

        result = {
            "operation_id": f"ocr_{int(datetime.now().timestamp())}",
            "type": "ocr_feed_analysis",
            "purpose": "feed_nutrition",
            "requires_user_action": False,
            "next_step": "前端將自動辨識並回傳結果"
        }
        return json.dumps(result, ensure_ascii=False, indent=2)

    @mcp.tool(
        name="perform_database_operation",
        description=(
            "Execute a database mutation (add/update/delete).\n\n"
            "⚠️ CRITICAL: Both 'operation' AND 'data' parameters are REQUIRED! NEVER omit data!\n\n"
            "WORKFLOW: get_operation_usage(op_name) → ask user for params → perform_database_operation(operation, data)\n\n"
            "COMMON OPERATIONS WITH REQUIRED DATA FIELDS:\n"
            "• add_plan: data={user_id, title, date, start_time, end_time, pet_id?, description?}\n"
            "  Example: perform_database_operation(operation='add_plan', data={'user_id': 1, 'title': '帶狗散步', 'date': '2025-12-08', 'start_time': '09:00', 'end_time': '10:00'})\n"
            "• update_plan: data={user_id, plan_id, title?, date?, start_time?, end_time?, is_completed?}\n"
            "• delete_plan: data={user_id, plan_id}\n"
            "• list_plans: data={user_id, pet_id?, start_date?, end_date?}\n"
            "• add_pet: data={user_id, pet_name, pet_type, weight, pet_stage, breed?, age?}\n"
            "• update_pet: data={pet_id, weight?, pet_stage?, age?, pet_name?}\n"
            "• add_abnormal_post: data={user_id, pet_id, symptoms, content, record_date?, is_emergency?}\n"
            "• update_abnormal_post: data={user_id, post_id, content?, symptoms?}\n"
            "• delete_abnormal_post: data={user_id, post_id}\n"
            "• create_social_post: data={user_id, content, has_images, hashtags?}\n"
            "• create_disease_archive: data={user_id, pet_id, archive_title, abnormal_post_ids, main_cause}\n"
            "• update_user: data={user_id, username?, user_fullname?, bio?, account_privacy?}\n"
            "• update_user_headshot: data={user_id, has_image}\n"
            "• add_feed: data={user_id, feed_name, brand?}\n"
            "• add_health_report: data={user_id, pet_id, report_date, ...}\n"
            "• update_health_report: data={user_id, report_id, ...}\n"
            "• delete_health_report: data={user_id, report_id}\n\n"
            "NOTE: Use requester_user_id from context as user_id."
        )
    )
    async def perform_database_operation(
        operation: Literal["add_pet", "update_pet", "update_user", "update_user_headshot", "add_abnormal_post", "update_abnormal_post", "delete_abnormal_post", "create_disease_archive", "add_plan", "update_plan", "delete_plan", "list_plans", "create_social_post", "add_feed", "prepare_health_report_ocr", "add_health_report", "update_health_report", "delete_health_report"],
        data: Dict[str, Any]
    ) -> str:
        print(f"[MCP Tool] ===== perform_database_operation CALLED =====")
        print(f"[MCP Tool] operation: {operation}")
        print(f"[MCP Tool] data: {data}")

        # Comprehensive hints for ALL operations
        error_hints = {
            # Plan operations
            "add_plan": "data={user_id, title, date, start_time, end_time, pet_id?, description?}",
            "update_plan": "data={user_id, plan_id, title?, date?, start_time?, end_time?, is_completed?}",
            "delete_plan": "data={user_id, plan_id}",
            "list_plans": "data={user_id, pet_id?, start_date?, end_date?}",
            # Pet operations
            "add_pet": "data={user_id, pet_name, pet_type, weight, pet_stage, breed?, age?}",
            "update_pet": "data={pet_id, weight?, pet_stage?, age?, pet_name?, breed?}",
            # User operations
            "update_user": "data={user_id, username?, user_fullname?, bio?, account_privacy?}",
            "update_user_headshot": "data={user_id, has_image}",
            # Abnormal post operations
            "add_abnormal_post": "data={user_id, pet_id, symptoms, content, record_date?, is_emergency?}",
            "update_abnormal_post": "data={user_id, post_id, content?, symptoms?}",
            "delete_abnormal_post": "data={user_id, post_id}",
            # Disease archive
            "create_disease_archive": "data={user_id, pet_id, archive_title, abnormal_post_ids, main_cause, content?}",
            # Social post
            "create_social_post": "data={user_id, content, has_images, hashtags?, location?}",
            # Feed
            "add_feed": "data={user_id, feed_name, brand?, pet_type?}",
            # Health report operations
            "prepare_health_report_ocr": "data={user_id, pet_id}",
            "add_health_report": "data={user_id, pet_id, report_date, report_type, ...}",
            "update_health_report": "data={user_id, report_id, ...fields to update}",
            "delete_health_report": "data={user_id, report_id}",
        }

        # Validate that data is provided and not empty
        if not data or (isinstance(data, dict) and len(data) == 0):
            hint = error_hints.get(operation, f"Call get_operation_usage('{operation}') to see required fields")
            error_result = {
                "success": False,
                "error": f"ERROR: 'data' parameter is REQUIRED but was empty or missing!",
                "operation": operation,
                "required_format": hint,
                "fix": f"Retry with: perform_database_operation(operation='{operation}', data={{...}})",
                "example": f"perform_database_operation(operation='{operation}', data={{{hint.replace('data=', '').replace('?', '')}}})"
            }
            print(f"[MCP Tool] ERROR: Empty data parameter")
            return json.dumps(error_result, ensure_ascii=False, indent=2)

        @sync_to_async
        def execute() -> Dict:
            return perform_operation(operation, data)

        result_dict = await execute()
        print(f"[MCP Tool] result: {result_dict}")
        print(f"[MCP Tool] ===== perform_database_operation FINISHED =====")
        return json.dumps(result_dict, ensure_ascii=False, indent=2)

    @mcp.tool(
        name="search_glossary",
        description=(
            "Search glossary for term definitions and concepts.\n"
            "USE WHEN: User asks '什麼是...', '...是什麼意思' (what is X?).\n"
            "NOT FOR: How-to questions (use search_system_faq instead).\n"
            "RETURNS: Term definitions with examples and related terms."
        )
    )
    async def search_glossary(
        query: str,
        category: Optional[str] = None,
        limit: int = 3
    ) -> str:
        """
        Search system glossary for term definitions

        Args:
            query: Term or keyword to search for
            category: Optional category filter (health, feed, social, schedule, system)
            limit: Maximum number of results to return (default: 3)

        Returns:
            JSON string with matching glossary entries
        """
        @sync_to_async
        def search():
            try:
                # Load glossary data
                current_dir = os.path.dirname(__file__)
                glossary_path = os.path.join(current_dir, 'glossary.json')

                with open(glossary_path, 'r', encoding='utf-8') as f:
                    glossary_data = json.load(f)

                terms = glossary_data.get('terms', [])
                query_lower = query.lower()

                # Score each term based on relevance
                scored_terms = []
                for term_entry in terms:
                    # Skip if category filter doesn't match
                    if category and term_entry.get('category') != category:
                        continue

                    score = 0

                    # Check exact term match (highest priority)
                    if query_lower == term_entry.get('term', '').lower():
                        score += 20

                    # Check term contains query or query contains term
                    if query_lower in term_entry.get('term', '').lower():
                        score += 15
                    elif term_entry.get('term', '').lower() in query_lower:
                        score += 12

                    # Check aliases match (high priority)
                    for alias in term_entry.get('aliases', []):
                        if query_lower == alias.lower():
                            score += 18
                        elif query_lower in alias.lower():
                            score += 10
                        elif alias.lower() in query_lower:
                            score += 8

                    # Check definition match (lower priority)
                    if query_lower in term_entry.get('definition', '').lower():
                        score += 3

                    # Check related terms (bonus points)
                    for related in term_entry.get('related_terms', []):
                        if query_lower in related.lower():
                            score += 2

                    if score > 0:
                        scored_terms.append({
                            'term': term_entry,
                            'score': score
                        })

                # Sort by score (descending) and take top results
                scored_terms.sort(key=lambda x: x['score'], reverse=True)
                top_terms = scored_terms[:limit]

                if not top_terms:
                    return {
                        "success": True,
                        "found": False,
                        "message": "未找到相關的名詞解釋",
                        "suggestion": "請嘗試使用不同的關鍵字，或確認拼寫是否正確"
                    }

                # Format results
                results = []
                for item in top_terms:
                    term = item['term']
                    result = {
                        "id": term.get('id'),
                        "term": term.get('term'),
                        "definition": term.get('definition'),
                        "category": term.get('category'),
                        "relevance_score": item['score']
                    }

                    # Add optional fields if available
                    if term.get('aliases'):
                        result['aliases'] = term.get('aliases')
                    if term.get('usage_example'):
                        result['usage_example'] = term.get('usage_example')
                    if term.get('related_terms'):
                        result['related_terms'] = term.get('related_terms')
                    if term.get('related_features'):
                        result['related_features'] = term.get('related_features')
                    if term.get('navigation_path'):
                        result['navigation_path'] = term.get('navigation_path')
                    if term.get('tutorial_types'):
                        result['tutorial_types'] = term.get('tutorial_types')
                    if term.get('technical_note'):
                        result['technical_note'] = term.get('technical_note')

                    results.append(result)

                return {
                    "success": True,
                    "found": True,
                    "query": query,
                    "count": len(results),
                    "results": results,
                    "message": f"找到 {len(results)} 個相關的名詞解釋"
                }

            except FileNotFoundError:
                return {
                    "success": False,
                    "error": "名詞詞彙表文件不存在"
                }
            except Exception as e:
                logger.error(f"搜尋名詞解釋時發生錯誤: {str(e)}", exc_info=True)
                return {
                    "success": False,
                    "error": f"搜尋名詞解釋時發生錯誤: {str(e)}"
                }

        result = await search()
        return json.dumps(result, ensure_ascii=False, indent=2)

    @mcp.tool(
        name="search_system_faq",
        description=(
            "Search FAQ for how-to questions about app features.\n"
            "USE WHEN: User asks '如何...', '怎麼...' (how to do X?).\n"
            "NOT FOR: Term definitions (use search_glossary instead).\n"
            "RETURNS: FAQ entries with answers and tutorial info if available."
        )
    )
    async def search_system_faq(
        query: str,
        category: Optional[str] = None,
        limit: int = 3
    ) -> str:
        """
        Search system FAQ database

        Args:
            query: User's question or keywords
            category: Optional category filter (account, social, pet, health, feed, forum, setting, system)
            limit: Maximum number of results to return (default: 3)

        Returns:
            JSON string with matching FAQ entries
        """
        @sync_to_async
        def search():
            try:
                # Load FAQ data
                current_dir = os.path.dirname(__file__)
                # Navigate to aiAgent/data directory
                faq_path = os.path.join(os.path.dirname(current_dir), 'aiAgent', 'data', 'system_faq.json')

                with open(faq_path, 'r', encoding='utf-8') as f:
                    faq_data = json.load(f)

                faqs = faq_data.get('faqs', [])
                query_lower = query.lower()

                # Score each FAQ based on relevance
                scored_faqs = []
                for faq in faqs:
                    # Skip if category filter doesn't match
                    if category and faq.get('category') != category:
                        continue

                    score = 0

                    # Check name match (highest priority)
                    if query_lower in faq.get('name', '').lower():
                        score += 10

                    # Check use_cases match (high priority)
                    for use_case in faq.get('use_cases', []):
                        if query_lower in use_case.lower() or use_case.lower() in query_lower:
                            score += 8

                    # Check keywords match (medium priority)
                    for keyword in faq.get('keywords', []):
                        if keyword.lower() in query_lower:
                            score += 3

                    # Check description match (lower priority)
                    if query_lower in faq.get('description', '').lower():
                        score += 2

                    if score > 0:
                        scored_faqs.append({
                            'faq': faq,
                            'score': score
                        })

                # Sort by score (descending) and take top results
                scored_faqs.sort(key=lambda x: x['score'], reverse=True)
                top_faqs = scored_faqs[:limit]

                if not top_faqs:
                    return {
                        "success": True,
                        "found": False,
                        "message": "未找到相關的 FAQ 項目",
                        "suggestion": "請嘗試使用不同的關鍵字，或直接描述您的問題"
                    }

                # Format results
                results = []
                for item in top_faqs:
                    faq = item['faq']
                    result = {
                        "id": faq.get('id'),
                        "question": faq.get('name'),
                        "answer": faq.get('answer'),
                        "category": faq.get('category'),
                        "relevance_score": item['score']
                    }

                    # Add tutorial info if available
                    if faq.get('has_tutorial'):
                        result['has_tutorial'] = True
                        result['tutorial_type'] = faq.get('tutorial_type')
                        result['tutorial_note'] = "可提供互動式教學"

                    results.append(result)

                return {
                    "success": True,
                    "found": True,
                    "query": query,
                    "count": len(results),
                    "results": results,
                    "message": f"找到 {len(results)} 個相關的 FAQ 項目"
                }

            except FileNotFoundError:
                return {
                    "success": False,
                    "error": "FAQ 資料庫文件不存在"
                }
            except Exception as e:
                return {
                    "success": False,
                    "error": f"搜尋 FAQ 時發生錯誤: {str(e)}"
                }

        result = await search()
        return json.dumps(result, ensure_ascii=False, indent=2)

    @mcp.tool(
        name="resolve_entity_context",
        description=(
            "Resolve entity IDs from natural language descriptions.\n"
            "USE WHEN: Need to find specific pet/post/report IDs for navigation or operations.\n"
            "ENTITY TYPES: pet, social_post, feed, user, health_report, disease_archive, abnormal_post, search_query.\n"
            "CONDITIONS: time_range ('today','last_week'), pet_name, keywords, newest/oldest.\n"
            "RETURNS: Matched entities with IDs and resolved paths."
        )
    )
    async def resolve_entity_context(
        entity_type: Literal["social_post", "feed", "pet", "user", "health_report", "disease_archive", "abnormal_post", "search_query"],
        user_id: int,
        conditions: Dict,
        limit: int = 5
    ) -> Dict:
        return await EntityResolver.resolve(entity_type, user_id, conditions, limit)

    return mcp
