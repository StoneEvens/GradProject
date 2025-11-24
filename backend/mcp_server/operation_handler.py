"""
═══════════════════════════════════════════════════════════════════════════════
OPERATION CONNECTOR - Unified Database Operations Module
═══════════════════════════════════════════════════════════════════════════════

This module consolidates all database operations for the MCP server:
- Query Operations (read-only database queries)
- Write Operations (create/update/delete operations)
- Unified Operation Registry for all operations

Previously scattered across:
- database_operations.py (write operations)
- entity_resolver.py (entity queries)
- server.py (direct DB queries)

Benefits:
- Single source of truth for all DB operations
- Unified registry maps ALL operations (query + write)
- Single entry point: perform_operation()
- Better organization and navigation
- Consistent error handling and logging
- Easier testing and maintenance

═══════════════════════════════════════════════════════════════════════════════
TABLE OF CONTENTS
═══════════════════════════════════════════════════════════════════════════════

SECTION 1: Imports & Configuration ........................... Line ~85
    - Django imports, logging setup, OpenAI client

SECTION 2: Query Operations (Read-Only) ...................... Line ~135
    Core query functions with entity resolution support:
    - get_user_pet_info_detailed() .................. detailed pet info
    - get_user_pet_list() ........................... supports conditions
    - get_post_recommendations() .................... post recommendations
    - get_user_information() ........................ supports conditions
    - get_user_pet_types() .......................... user's pet types
    - get_pet_foods_details() ....................... supports conditions
    
    Consolidated entity query functions:
    - get_social_posts() ............................ social post queries
    - get_health_reports() .......................... health report queries
    - get_disease_archives() ........................ disease archive queries
    - get_abnormal_posts() .......................... abnormal post queries
    - generate_search_query() ....................... search query generation

SECTION 3: Write Operations (Create/Update/Delete) ........... Line ~890
    - Pet Operations (add_pet, update_pet)
    - User Operations (update_user, update_user_headshot)
    - Health Operations (abnormal posts, disease archives)
    - Social Operations (create_social_post)
    - Feed Operations (add_feed, prepare_feed_ocr)
    - Plan Operations (add/update/delete/complete/list)
    - Health Report Operations (add/update/delete/prepare_ocr)
    
SECTION 4: Unified API & Helper Functions .................... Line ~1800
    Registry & API:
    - OPERATION_REGISTRY ............................ unified query + write ops
    - QUERY_ENTITY_TYPES ............................ supported entity types
    - perform_operation() ........................... MAIN entry point
    - perform_database_operation() .................. legacy write API
    - resolve_entity_context() ...................... legacy query API
    - get_operation_list() .......................... operation metadata
    
    Helper Functions:
    - AI Content Generation (disease archive summaries)
    - Image Processing Utilities

═══════════════════════════════════════════════════════════════════════════════
UNIFIED API USAGE
═══════════════════════════════════════════════════════════════════════════════

Unified API (recommended):
    # Write operation
    perform_operation("write", "add_pet", {"user_id": 1, "pet_name": "Buddy", ...})
    
    # Query operation
    perform_operation("query", "pet", user_id=1, conditions={"pet_name": "Buddy"}, limit=5)

Legacy APIs (still supported for backward compatibility):
    # Write operations
    perform_database_operation("add_pet", {"user_id": 1, "pet_name": "Buddy", ...})
    
    # Query operations
    resolve_entity_context("pet", user_id=1, conditions={"pet_name": "Buddy"}, limit=5)

Operation Registry:
    All operations are registered in OPERATION_REGISTRY:
    - Query operations: "query:social_post", "query:pet", "query:feed", etc.
    - Write operations: "add_pet", "update_pet", "create_social_post", etc.

═══════════════════════════════════════════════════════════════════════════════
"""

# ============================================================================
# SECTION 1: IMPORTS & CONFIGURATION
# ============================================================================

import os
import json
import logging
import re
import math
from typing import Dict, Any, List, Tuple, Optional, Literal, Union
from datetime import datetime, date, time, timedelta
from decimal import Decimal

# Django Core
from django.db import transaction
from django.db.models import Q, F, Prefetch, Max
from django.utils import timezone
from django.utils.text import slugify
from django.contrib.auth import get_user_model
from django.forms.models import model_to_dict
from asgiref.sync import sync_to_async

# Django Apps & Models
from accounts.models import CustomUser, Plan
from pets.models import (
    Pet, AbnormalPost, DiseaseArchiveContent, Symptom, Illness,
    PostSymptomsRelation, ArchiveAbnormalPostRelation, ArchiveIllnessRelation
)
from social.models import PostFrame, SoLContent, PostHashtag, PostPets
from feeds.models import Feed
from media.models import AbnormalPostImage, PetHeadshot, UserHeadshot
from ocrapp.models import HealthReport

# Serializers
from pets.serializers import AbnormalPostSerializer, DiseaseArchiveContentSerializer
from social.serializers import PostFrameSerializer

# Utilities
from utils.recommendation_service import RecommendationService
from social.apps import SocialConfig

# Logging Configuration
logger = logging.getLogger(__name__)

# Get User Model
User = get_user_model()


# ============================================================================
# SECTION 2: QUERY OPERATIONS (Read-Only Database Queries)
# ============================================================================
#
# This section contains all read operations for fetching data from database.
# These operations DO NOT modify data - they are pure queries.
#
# Functions in this section:
# - get_user_pet_info_detailed: Fetch user profile with pets and abnormal posts
# - get_user_pet_list: Get simple list of user's pets
# - get_post_recommendations: Get recommended posts based on content/hashtags
# - get_user_information: Fetch basic info of users by IDs
# - get_user_pet_types: Get types of pets owned by users
# - get_pet_foods_details: Fetch detailed information about all pet foods
#
# All functions return Dict (synchronous) - async wrapping done at server level
# ============================================================================

def get_user_pet_info_detailed(user_id: int) -> Dict:
    """
    Fetch a user's basic profile and their pets, including abnormal posts.
    
    This is used by the agent to get comprehensive pet health information.
    
    Args:
        user_id: User ID to fetch information for
        
    Returns:
        Dict with keys:
            - success: Boolean
            - user: Username string
            - user_id: User ID
            - pets: List of pet dicts with abnormal_posts nested
            - abnormal_posts: Flattened list of all abnormal posts
            
    Example:
        result = get_user_pet_info_detailed(user_id=123)
        if result['success']:
            pets = result['pets']
            for pet in pets:
                print(f"Pet: {pet['pet_name']}, Posts: {len(pet['abnormal_posts'])}")
    """
    try:
        logger.info(f"[get_user_pet_info_detailed] Fetching user with id={user_id}")
        
        # Fetch user
        user = CustomUser.objects.filter(id=user_id).first()
        if not user:
            logger.warning(f"[get_user_pet_info_detailed] User {user_id} not found")
            return {
                "success": False,
                "error": f"User with ID {user_id} not found."
            }
        
        logger.info(f"[get_user_pet_info_detailed] Found user: {user.username}")
        
        # Get user's pets with related data
        pets_qs = (Pet.objects
                   .filter(owner=user)
                   .select_related()
                   .prefetch_related('abnormal_posts'))
        
        pets_data: List[dict] = []
        all_abnormal_posts_data: List[dict] = []
        
        logger.info(f"[get_user_pet_info_detailed] Processing {pets_qs.count()} pets")
        
        for pet in pets_qs:
            pet_dict = model_to_dict(pet)
            
            # Serialize related abnormal posts
            abnormal_list = list(pet.abnormal_posts.all())
            abnormal_ser = AbnormalPostSerializer(abnormal_list, many=True)
            abnormal_data = json.loads(json.dumps(abnormal_ser.data, default=str))
            
            pet_dict['abnormal_posts'] = abnormal_data
            pets_data.append(pet_dict)
            all_abnormal_posts_data.extend(abnormal_data)
        
        # Ensure JSON-serializable
        pets_data = json.loads(json.dumps(pets_data, default=str))
        
        result = {
            "success": True,
            "user": user.username,
            "user_id": user_id,
            "pets": pets_data,
            "abnormal_posts": all_abnormal_posts_data
        }
        
        logger.info(f"[get_user_pet_info_detailed] Success: {len(pets_data)} pets, {len(all_abnormal_posts_data)} abnormal posts")
        return result
        
    except Exception as e:
        logger.error(f"[get_user_pet_info_detailed] Error: {type(e).__name__}: {str(e)}", exc_info=True)
        return {
            "success": False,
            "error": f"{type(e).__name__}: {str(e)}"
        }


def get_user_pet_list(user_id: int) -> Dict:
    """
    Fetch a simple list of user's pets (without abnormal posts).
    
    Lighter than get_user_pet_info_detailed - use when you only need basic pet info.
    
    Args:
        user_id: User ID to fetch pets for
        
    Returns:
        Dict with keys:
            - success: Boolean
            - user: Username string
            - user_id: User ID
            - pets: List of pet dicts with basic info (id, name, type, breed, age, weight)
    """
    try:
        user = CustomUser.objects.filter(id=user_id).first()
        if not user:
            return {
                "success": False,
                "error": "User not found."
            }
        
        pets_qs = Pet.objects.filter(owner=user)
        
        pets_data: List[dict] = []
        for pet in pets_qs:
            pets_data.append({
                'id': pet.id,
                'name': pet.pet_name,
                'type': pet.pet_type,
                'breed': pet.breed,
                'age': pet.age,
                'weight': pet.weight,
            })
        
        # Ensure JSON-serializable
        pets_data = json.loads(json.dumps(pets_data, default=str))
        
        return {
            "success": True,
            "user": user.username,
            "user_id": user_id,
            "pets": pets_data
        }
        
    except Exception as e:
        logger.error(f"[get_user_pet_list] Error: {str(e)}", exc_info=True)
        return {
            "success": False,
            "error": f"Failed to fetch pet list: {str(e)}"
        }


def get_post_recommendations(
    content_description: str,
    hashtags: List[str],
    is_social: bool,
    is_forum: bool
) -> List[Dict]:
    """
    Get recommended social posts or disease archives based on content description.
    
    Uses the recommendation service with embedding similarity.
    
    Args:
        content_description: Natural language description of desired content
        hashtags: List of hashtags to consider
        is_social: Whether to search social posts
        is_forum: Whether to search forum (disease archives)
        
    Returns:
        List of post dicts (top 3 from each source)
    """
    try:
        posts_data: List[dict] = []
        
        # Get recommendation service
        recommendation_service = SocialConfig.get_recommendation_service()
        if recommendation_service is None:
            return [{
                "error": "Recommendation service not available."
            }]
        
        # Embed the content description
        embedded_description = recommendation_service.embed_content(
            content_description,
            hashtags=hashtags
        )
        
        # Search social posts
        if is_social:
            recommended_post_ids = recommendation_service.recommend_posts(
                user_vec=embedded_description,
                content_type='social'
            )
            top_post_ids = recommended_post_ids[:3]
            
            posts = PostFrame.get_postFrames(idList=top_post_ids)
            serializer = PostFrameSerializer(posts, many=True)
            posts_data += json.loads(json.dumps(serializer.data, default=str))
        
        # Search forum (disease archives)
        if is_forum:
            recommended_post_ids = recommendation_service.recommend_posts(
                user_vec=embedded_description,
                content_type='forum'
            )
            top_post_ids = recommended_post_ids[:3]
            
            archives = DiseaseArchiveContent.get_content(ids=top_post_ids)
            serializer = DiseaseArchiveContentSerializer(archives, many=True)
            posts_data += json.loads(json.dumps(serializer.data, default=str))
        
        for post in posts_data:
            logger.debug(f"Recommended Post ID: {post.get('id')} Title: {post.get('title')}")
        
        return posts_data
        
    except Exception as e:
        logger.error(f"[get_post_recommendations] Error: {str(e)}", exc_info=True)
        return [{
            "error": f"Failed to get recommendations: {str(e)}"
        }]


def get_social_posts(user_id: int, conditions: Dict = None, limit: int = 5) -> Dict:
    """
    Fetch social posts with optional filtering.
    Supports entity resolution patterns for post queries.
    
    Args:
        user_id: User ID whose posts to fetch
        conditions: Optional filters dict with keys:
            - time_range: "last_week", "last_month", "today", "yesterday", "last_sunday"
            - specific_date: "2025-11-03"
            - keywords: List of keywords to search in content
            - order_by: "latest", "oldest", "most_liked"
        limit: Maximum results to return (default 5)
        
    Returns:
        Dict with social posts and path resolution
    """
    try:
        queryset = PostFrame.objects.filter(author_id=user_id)

        if conditions:
            # Time range filtering
            if "time_range" in conditions:
                time_range = conditions["time_range"]
                now = timezone.now()

                if time_range == "today":
                    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
                    queryset = queryset.filter(created_at__gte=start)
                elif time_range == "yesterday":
                    start = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
                    end = now.replace(hour=0, minute=0, second=0, microsecond=0)
                    queryset = queryset.filter(created_at__gte=start, created_at__lt=end)
                elif time_range == "last_week":
                    start = now - timedelta(days=7)
                    queryset = queryset.filter(created_at__gte=start)
                elif time_range == "last_month":
                    start = now - timedelta(days=30)
                    queryset = queryset.filter(created_at__gte=start)
                elif time_range == "last_sunday":
                    days_since_sunday = (now.weekday() + 1) % 7
                    if days_since_sunday == 0:
                        days_since_sunday = 7
                    last_sunday = (now - timedelta(days=days_since_sunday)).replace(hour=0, minute=0, second=0)
                    next_day = last_sunday + timedelta(days=1)
                    queryset = queryset.filter(created_at__gte=last_sunday, created_at__lt=next_day)

            # Specific date filtering
            if "specific_date" in conditions:
                date_str = conditions["specific_date"]
                target_date = datetime.strptime(date_str, "%Y-%m-%d")
                next_day = target_date + timedelta(days=1)
                queryset = queryset.filter(created_at__gte=target_date, created_at__lt=next_day)

            # Keyword search
            if "keywords" in conditions:
                keywords = conditions["keywords"]
                q_objects = Q()
                for keyword in keywords:
                    q_objects |= Q(content__content__icontains=keyword)
                queryset = queryset.filter(q_objects)

            # Ordering
            order_by = conditions.get("order_by", "latest")
            if order_by == "latest":
                queryset = queryset.order_by("-created_at")
            elif order_by == "oldest":
                queryset = queryset.order_by("created_at")
            elif order_by == "most_liked":
                queryset = queryset.order_by("-likes_count")

        posts = queryset[:limit]

        # Build results with path resolution
        results = []
        for post in posts:
            content = getattr(post, 'content', None)
            results.append({
                "id": post.id,
                "content_preview": content.content[:100] if content else "無內容",
                "created_at": post.created_at.isoformat() if post.created_at else None,
                "likes_count": getattr(post, 'likes_count', 0),
                "path_template": "/post/{id}/edit",
                "resolved_path": f"/post/{post.id}/edit"
            })

        return {
            "success": True,
            "entity_type": "social_post",
            "count": len(results),
            "results": results,
            "message": f"找到 {len(results)} 篇符合條件的貼文"
        }

    except Exception as e:
        logger.error(f"[get_social_posts] Error: {str(e)}", exc_info=True)
        return {"success": False, "error": f"查詢社群貼文失敗: {str(e)}"}


def get_post_recommendations(
    content_description: str,
    hashtags: List[str],
    is_social: bool,
    is_forum: bool
) -> List[Dict]:
    """
    Get recommended social posts or disease archives based on content description.
    
    Uses the recommendation service with embedding similarity.
    
    Args:
        content_description: Natural language description of desired content
        hashtags: List of hashtags to consider
        is_social: Whether to search social posts
        is_forum: Whether to search forum (disease archives)
        
    Returns:
        List of post dicts (top 3 from each source)
    """
    try:
        posts_data: List[dict] = []
        
        # Get recommendation service
        recommendation_service = SocialConfig.get_recommendation_service()
        if recommendation_service is None:
            return [{
                "error": "Recommendation service not available."
            }]
        
        # Embed the content description
        embedded_description = recommendation_service.embed_content(
            content_description,
            hashtags=hashtags
        )
        
        # Search social posts
        if is_social:
            recommended_post_ids = recommendation_service.recommend_posts(
                user_vec=embedded_description,
                content_type='social'
            )
            top_post_ids = recommended_post_ids[:3]
            
            posts = PostFrame.get_postFrames(idList=top_post_ids)
            serializer = PostFrameSerializer(posts, many=True)
            posts_data += json.loads(json.dumps(serializer.data, default=str))
        
        # Search forum (disease archives)
        if is_forum:
            recommended_post_ids = recommendation_service.recommend_posts(
                user_vec=embedded_description,
                content_type='forum'
            )
            top_post_ids = recommended_post_ids[:3]
            
            archives = DiseaseArchiveContent.get_content(ids=top_post_ids)
            serializer = DiseaseArchiveContentSerializer(archives, many=True)
            posts_data += json.loads(json.dumps(serializer.data, default=str))
        
        for post in posts_data:
            logger.debug(f"Recommended Post ID: {post.get('id')} Title: {post.get('title')}")
        
        return posts_data
        
    except Exception as e:
        logger.error(f"[get_post_recommendations] Error: {str(e)}", exc_info=True)
        return [{
            "error": f"Failed to get recommendations: {str(e)}"
        }]


def get_user_information(user_ids: List[int]) -> Dict:
    """
    Fetch basic information of users by their IDs.
    
    Only returns public users to avoid leaking private profile data.
    
    Args:
        user_ids: List of user IDs to fetch
        
    Returns:
        Dict with keys:
            - users: Dict mapping user_id -> user info
            - requested_ids: List of requested IDs
            - found_ids: List of IDs that were found
    """
    try:
        users_info: Dict[int, Dict] = {}
        
        # Fetch only public users
        users = CustomUser.objects.filter(
            id__in=user_ids,
            account_privacy='public'
        )
        
        for user in users:
            # Build user info dict (exclude sensitive fields)
            data: Dict[str, Optional[str]] = {
                "id": user.id,
                "username": getattr(user, 'username', None),
                "user_account": getattr(user, 'user_account', None),
                "user_fullname": getattr(user, 'user_fullname', None),
                "user_intro": getattr(user, 'user_intro', None),
                "account_privacy": getattr(user, 'account_privacy', None),
            }
            
            # Add headshot URL if available
            headshot = getattr(user, 'headshot', None)
            if headshot and getattr(headshot, 'url', None):
                data["headshot_url"] = headshot.url
            
            # Add timestamps if available
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
        logger.error(f"[get_user_information] Error: {str(e)}", exc_info=True)
        return {
            "error": f"Failed to fetch user information: {str(e)}"
        }


def get_pet_foods_details(conditions: Dict = None, limit: int = 10, return_with_paths: bool = False) -> Union[List[Dict], Dict]:
    """
    Fetch detailed information about pet foods with optional filtering.
    Supports both full list queries and entity resolution patterns.
    
    Args:
        conditions: Optional filters dict with keys:
            - pet_type: Filter by pet type ("dog", "cat", etc.)
            - keywords: List of keywords to search in brand/product
            - usage: Usage filter ("last_viewed", "most_viewed", "marked")
            - order_by: Ordering ("latest", default)
        limit: Maximum results to return (default 10, ignored if no conditions)
        return_with_paths: If True, return results with path resolution info
        
    Returns:
        List of feed dicts or entity resolution format dict
    """
    try:
        queryset = Feed.objects.all().prefetch_related("ratings")
        
        # Apply conditions if provided (entity resolution mode)
        if conditions:
            # Pet type filtering
            if "pet_type" in conditions:
                queryset = queryset.filter(pet_type__iexact=conditions["pet_type"])
            
            # Keyword search in brand and product line
            if "keywords" in conditions:
                keywords = conditions["keywords"]
                q_objects = Q()
                for keyword in keywords:
                    q_objects |= Q(brand_name__icontains=keyword) | Q(product_line__icontains=keyword)
                queryset = queryset.filter(q_objects)
            
            # Ordering
            order_by = conditions.get("order_by", "latest")
            if order_by == "latest":
                queryset = queryset.order_by("-id")
            
            # Apply limit
            queryset = queryset[:limit]
        
        pet_foods = queryset
        
        # Entity resolution format with paths
        if return_with_paths or conditions:
            results = []
            for feed in pet_foods:
                results.append({
                    "id": feed.id,
                    "brand_name": feed.brand_name,
                    "product_line": feed.product_line,
                    "pet_type": feed.pet_type,
                    "price": float(feed.price) if feed.price else None,
                    "protein": float(feed.protein) if hasattr(feed, 'protein') else None,
                    "fat": float(feed.fat) if hasattr(feed, 'fat') else None,
                    "path_template": "/feeds/{id}",
                    "resolved_path": f"/feeds/{feed.id}"
                })
            
            return {
                "success": True,
                "entity_type": "feed",
                "count": len(results),
                "results": results,
                "message": f"找到 {len(results)} 個符合條件的飼料"
            }
        
        # Original simple format (full list)
        pet_foods_data: List[dict] = []
        for food in pet_foods:
            food_dict = model_to_dict(food)
            pet_foods_data.append(food_dict)
        
        return json.loads(json.dumps(pet_foods_data, default=str))
        
    except Exception as e:
        logger.error(f"[get_pet_foods_details] Error: {str(e)}", exc_info=True)
        return [{
            "error": f"Failed to fetch pet foods details: {str(e)}"
        }]


def get_health_reports(user_id: int, conditions: Dict = None, limit: int = 5) -> Dict:
    """
    Fetch health reports with optional filtering.
    Supports entity resolution patterns for health report queries.
    
    Args:
        user_id: User ID whose pets' reports to fetch
        conditions: Optional filters dict with keys:
            - pet_id: Filter by specific pet ID
            - time_range: "last_week", "last_month"
            - newest: Sort by newest first (bool)
        limit: Maximum results to return (default 5)
        
    Returns:
        Dict with health reports and path resolution
    """
    try:
        # Get user's pets
        user_pets = Pet.objects.filter(owner_id=user_id).values_list('id', flat=True)
        queryset = HealthReport.objects.filter(pet_id__in=user_pets)

        if conditions:
            # Specific pet filter
            if "pet_id" in conditions:
                queryset = queryset.filter(pet_id=conditions["pet_id"])

            # Time range filter
            if "time_range" in conditions:
                time_range = conditions["time_range"]
                now = timezone.now()

                if time_range == "last_week":
                    start = now - timedelta(days=7)
                    queryset = queryset.filter(created_at__gte=start)
                elif time_range == "last_month":
                    start = now - timedelta(days=30)
                    queryset = queryset.filter(created_at__gte=start)

            # Ordering
            if conditions.get("newest"):
                queryset = queryset.order_by("-created_at")
            else:
                queryset = queryset.order_by("-created_at")

        reports = queryset[:limit]

        # Build results with path resolution
        results = []
        for report in reports:
            check_type_mapping = {
                "cbc": "全血計數",
                "biochemistry": "血液生化檢查",
                "urinalysis": "尿液分析",
                "other": "其他"
            }
            check_type_zh = check_type_mapping.get(report.check_type, report.check_type)

            results.append({
                "id": report.id,
                "pet_id": report.pet_id,
                "pet_name": report.pet.pet_name,
                "check_date": report.check_date.strftime("%Y-%m-%d") if report.check_date else None,
                "check_type": report.check_type,
                "check_type_zh": check_type_zh,
                "check_location": report.check_location or "",
                "created_at": report.created_at.isoformat() if report.created_at else None,
                "path_template": "/pet/{pet_id}/health-report/{id}",
                "resolved_path": f"/pet/{report.pet_id}/health-report/{report.id}"
            })

        return {
            "success": True,
            "entity_type": "health_report",
            "count": len(results),
            "results": results,
            "message": f"找到 {len(results)} 份符合條件的健康報告"
        }

    except Exception as e:
        logger.error(f"[get_health_reports] Error: {str(e)}", exc_info=True)
        return {"success": False, "error": f"查詢健康報告失敗: {str(e)}"}


def get_disease_archives(user_id: int, conditions: Dict = None, limit: int = 5) -> Dict:
    """
    Fetch disease archives with optional filtering.
    
    Args:
        user_id: User ID whose pets' archives to fetch
        conditions: Optional filters dict with keys:
            - pet_id: Filter by specific pet ID
        limit: Maximum results to return (default 5)
        
    Returns:
        Dict with disease archives and path resolution
    """
    try:
        user_pets = Pet.objects.filter(owner_id=user_id).values_list('id', flat=True)
        queryset = DiseaseArchiveContent.objects.filter(pet_id__in=user_pets)

        if conditions and "pet_id" in conditions:
            queryset = queryset.filter(pet_id=conditions["pet_id"])

        queryset = queryset.order_by("-created_at")
        archives = queryset[:limit]

        # Build results with path resolution
        results = []
        for archive in archives:
            results.append({
                "id": archive.id,
                "pet_id": archive.pet_id,
                "title": archive.title,
                "path_template": "/pet/{pet_id}/disease-archive/{id}",
                "resolved_path": f"/pet/{archive.pet_id}/disease-archive/{archive.id}"
            })

        return {
            "success": True,
            "entity_type": "disease_archive",
            "count": len(results),
            "results": results,
            "message": f"找到 {len(results)} 份符合條件的疾病檔案"
        }

    except Exception as e:
        logger.error(f"[get_disease_archives] Error: {str(e)}", exc_info=True)
        return {"success": False, "error": f"查詢疾病檔案失敗: {str(e)}"}


def get_abnormal_posts(user_id: int, conditions: Dict = None, limit: int = 5) -> Dict:
    """
    Fetch abnormal health posts with optional filtering.
    
    Args:
        user_id: User ID whose pets' posts to fetch
        conditions: Optional filters dict with keys:
            - pet_id: Filter by specific pet ID
        limit: Maximum results to return (default 5)
        
    Returns:
        Dict with abnormal posts and path resolution
    """
    try:
        user_pets = Pet.objects.filter(owner_id=user_id).values_list('id', flat=True)
        queryset = AbnormalPost.objects.filter(pet_id__in=user_pets)

        if conditions and "pet_id" in conditions:
            queryset = queryset.filter(pet_id=conditions["pet_id"])

        queryset = queryset.order_by("-created_at")
        posts = queryset[:limit]

        # Build results with path resolution
        results = []
        for post in posts:
            results.append({
                "id": post.id,
                "pet_id": post.pet_id,
                "created_at": post.created_at.isoformat() if post.created_at else None,
                "path_template": "/pet/{pet_id}/abnormal-post/{id}",
                "resolved_path": f"/pet/{post.pet_id}/abnormal-post/{post.id}"
            })

        return {
            "success": True,
            "entity_type": "abnormal_post",
            "count": len(results),
            "results": results,
            "message": f"找到 {len(results)} 筆符合條件的異常記錄"
        }

    except Exception as e:
        logger.error(f"[get_abnormal_posts] Error: {str(e)}", exc_info=True)
        return {"success": False, "error": f"查詢異常記錄失敗: {str(e)}"}


def generate_search_query(conditions: Dict) -> Dict:
    """
    Generate search query paths for frontend navigation.
    
    Args:
        conditions: Required dict with keys:
            - search_type: "social" or "feed" (required)
            - keywords: List of keywords (required)
            - description: Natural language description (optional)
            
    Returns:
        Dict with search query path resolution
    """
    try:
        # Validate required fields
        search_type = conditions.get("search_type")
        if not search_type:
            return {"success": False, "error": "必須指定 search_type (social 或 feed)"}

        keywords = conditions.get("keywords", [])
        if not keywords:
            return {"success": False, "error": "必須提供至少一個關鍵字"}

        # Combine keywords into query string
        query_string = " ".join(keywords)

        # Generate path based on search type
        if search_type == "social":
            resolved_path = f"/social?q={query_string}"
            friendly_name = "社群搜尋"
            search_scope = "論壇、標籤、用戶、貼文"
        elif search_type == "feed":
            resolved_path = f"/feeds/search?q={query_string}"
            friendly_name = "飼料搜尋"
            search_scope = "飼料產品"
        else:
            return {
                "success": False,
                "error": f"不支援的搜尋類型: {search_type}。支援的類型：social, feed"
            }

        description = conditions.get("description", f"搜尋{search_scope}：{query_string}")

        result = {
            "search_type": search_type,
            "query": query_string,
            "keywords": keywords,
            "search_scope": search_scope,
            "description": description,
            "path_template": f"/social?q={{query}}" if search_type == "social" else "/feeds/search?q={query}",
            "resolved_path": resolved_path,
            "friendly_name": friendly_name
        }

        return {
            "success": True,
            "entity_type": "search_query",
            "count": 1,
            "results": [result],
            "message": f"已生成{friendly_name}查詢：{query_string}"
        }

    except Exception as e:
        logger.error(f"[generate_search_query] Error: {str(e)}", exc_info=True)
        return {"success": False, "error": f"解析搜尋查詢失敗: {str(e)}"}


# ============================================================================
#                            SECTION 3: Write Operations
# ============================================================================
"""
This section contains all CREATE/UPDATE/DELETE operations migrated from
database_operations.py. Operations are organized by category:
- Pet Management (add_pet, update_pet)
- User Management (update_user, update_user_headshot)
- Health Records (add_abnormal_post, update_abnormal_post, delete_abnormal_post)
- Disease Archives (create_disease_archive)
- Social Posts (create_social_post)
- Feed Management (add_feed, prepare_feed_ocr)
- Plan Management (add_plan, update_plan, delete_plan, complete_plan, list_plans)
- Health Reports (add_health_report, update_health_report, delete_health_report, prepare_health_report_ocr)
"""

# ---------- Pet Management Operations ----------

def add_pet(data: Dict) -> Dict:
    """
    Add a new pet to the database
    
    Required fields: user_id, pet_name, pet_type, weight, pet_stage
    Optional fields: age, breed, predicted_adult_weight, description, height, weeks_of_lactation
    """
    required_fields = ["user_id", "pet_name", "pet_type", "weight", "pet_stage"]
    missing_fields = [f for f in required_fields if f not in data]
    if missing_fields:
        return {"error": f"Missing required fields: {', '.join(missing_fields)}"}
    
    try:
        owner = CustomUser.objects.get(id=data["user_id"])
    except CustomUser.DoesNotExist:
        return {"error": f"User with id {data['user_id']} not found"}
    
    pet = Pet.objects.create(
        owner=owner,
        pet_name=data["pet_name"],
        pet_type=data["pet_type"],
        weight=data["weight"],
        pet_stage=data["pet_stage"],
        age=data.get("age"),
        breed=data.get("breed"),
        predicted_adult_weight=data.get("predicted_adult_weight"),
        description=data.get("description"),
        height=data.get("height"),
        weeks_of_lactation=data.get("weeks_of_lactation")
    )
    
    return {
        "success": True,
        "message": f"Pet '{pet.pet_name}' created successfully",
        "pet_id": pet.id,
        "pet_data": {
            "id": pet.id,
            "pet_name": pet.pet_name,
            "pet_type": pet.pet_type,
            "weight": pet.weight,
            "pet_stage": pet.pet_stage,
            "breed": pet.breed,
            "age": pet.age
        }
    }

def update_pet(data: Dict) -> Dict:
    """Update pet information"""
    if "pet_id" not in data:
        return {"error": "Missing required field: pet_id"}
    
    try:
        pet = Pet.objects.get(id=data["pet_id"])
    except Pet.DoesNotExist:
        return {"error": f"Pet with id {data['pet_id']} not found"}
    
    owner = None
    if "owner" in data:
        try:
            owner = CustomUser.objects.get(id=data["owner"])
        except CustomUser.DoesNotExist:
            return {"error": f"User with id {data['owner']} not found"}
    
    pet.update(
        owner=owner,
        weight=data.get("weight"),
        pet_stage=data.get("pet_stage"),
        age=data.get("age"),
        pet_name=data.get("pet_name"),
        breed=data.get("breed"),
        pet_type=data.get("pet_type"),
        predicted_adult_weight=data.get("predicted_adult_weight"),
        description=data.get("description")
    )
    
    pet.refresh_from_db()
    
    return {
        "success": True,
        "message": f"Pet '{pet.pet_name}' updated successfully",
        "pet_id": pet.id,
        "pet_data": {
            "id": pet.id,
            "pet_name": pet.pet_name,
            "pet_type": pet.pet_type,
            "weight": pet.weight,
            "pet_stage": pet.pet_stage,
            "breed": pet.breed,
            "age": pet.age,
            "description": pet.description
        }
    }


# ---------- User Management Operations ----------

def update_user(data: Dict) -> Dict:
    """Update user information including account privacy settings"""
    if "user_id" not in data:
        return {"error": "Missing required field: user_id"}

    try:
        user = CustomUser.objects.get(id=data["user_id"])
    except CustomUser.DoesNotExist:
        return {"error": f"User with id {data['user_id']} not found"}

    updatable_fields = ["username", "user_fullname", "bio", "account_privacy"]
    if not any(field in data for field in updatable_fields):
        return {"error": "At least one field must be provided to update"}

    updated_fields = []

    if "username" in data:
        if CustomUser.objects.filter(user_account=data["username"]).exclude(id=user.id).exists():
            return {"error": f"Username '{data['username']}' is already taken"}
        user.user_account = data["username"]
        updated_fields.append("username")

    if "user_fullname" in data:
        user.user_fullname = data["user_fullname"]
        updated_fields.append("user_fullname")

    if "bio" in data:
        user.user_intro = data["bio"]
        updated_fields.append("bio")

    if "account_privacy" in data:
        privacy_value = data["account_privacy"]
        if privacy_value not in ["public", "private"]:
            return {"error": f"Invalid account_privacy value: '{privacy_value}'"}
        user.account_privacy = privacy_value
        updated_fields.append("account_privacy")

    user.save(update_fields=[
        field.replace("username", "user_account").replace("bio", "user_intro")
        for field in updated_fields
    ])

    user.refresh_from_db()
    
    return {
        "success": True,
        "message": "User information updated successfully",
        "user_id": user.id,
        "updated_fields": updated_fields,
        "user_data": {
            "id": user.id,
            "username": user.user_account,
            "user_fullname": user.user_fullname,
            "bio": user.user_intro,
            "account_privacy": user.account_privacy
        }
    }


def update_user_headshot(data: Dict) -> Dict:
    """Prepare user headshot update (actual upload handled by frontend)"""
    required_fields = ["user_id", "has_image"]
    missing_fields = [f for f in required_fields if f not in data]
    if missing_fields:
        return {"error": "Missing required fields", "missing_fields": missing_fields}
    
    if not data.get("has_image"):
        return {
            "error": "用戶尚未選擇頭像圖片",
            "user_message": "請先點擊聊天框左下角的相片按鈕選擇您想要設定為頭像的照片。",
            "should_ask_user": True
        }
    
    try:
        user = CustomUser.objects.get(id=data["user_id"])
    except CustomUser.DoesNotExist:
        return {"error": f"User with id {data['user_id']} not found"}
    
    return {
        "success": True,
        "message": "準備更新頭像！",
        "note": "圖片會由前端自動上傳。",
        "user_id": user.id,
        "status": "ready_for_upload",
        "user_data": {"id": user.id, "username": user.user_account}
    }


# ---------- Health Records Operations ----------

@transaction.atomic
def add_abnormal_post(data: Dict) -> Dict:
    """Add abnormal health record for a pet"""
    required_fields = ["user_id", "pet_id", "symptoms"]
    missing_fields = [f for f in required_fields if f not in data]
    if missing_fields:
        return {"error": f"Missing required fields: {', '.join(missing_fields)}"}
    
    try:
        user = CustomUser.objects.get(id=data["user_id"])
        pet = Pet.objects.get(id=data["pet_id"], owner=user)
    except CustomUser.DoesNotExist:
        return {"error": f"User with id {data['user_id']} not found"}
    except Pet.DoesNotExist:
        return {"error": f"Pet with id {data['pet_id']} not found or does not belong to user"}
    
    symptoms = data.get("symptoms", [])
    if not symptoms or not isinstance(symptoms, list):
        return {"error": "Symptoms must be a non-empty list"}
    
    # Handle record date
    record_date = None
    if data.get("record_date"):
        try:
            record_date = datetime.fromisoformat(data["record_date"].replace('Z', '+00:00'))
            
            # Check if record exists for this date
            date_start = record_date.replace(hour=0, minute=0, second=0, microsecond=0)
            date_end = record_date.replace(hour=23, minute=59, second=59, microsecond=999999)
            
            if AbnormalPost.objects.filter(pet=pet, record_date__range=(date_start, date_end)).exists():
                return {"error": f"Pet already has an abnormal post on {record_date.strftime('%Y-%m-%d')}"}
        except ValueError as e:
            return {"error": f"Invalid date format: {str(e)}"}
    
    # Create abnormal post
    abnormal_post = AbnormalPost.objects.create(
        pet=pet,
        user=user,
        content=data.get("content", ""),
        weight=float(data["weight"]) if data.get("weight") else None,
        body_temperature=float(data["body_temperature"]) if data.get("body_temperature") else None,
        water_amount=int(data["water_amount"]) if data.get("water_amount") else None,
        is_emergency=data.get("is_emergency", False),
        record_date=record_date,
        is_private=data.get("is_private", True)
    )
    
    # Add symptom relations
    symptoms_added = []
    symptoms_not_found = []
    
    for symptom_text in symptoms:
        if isinstance(symptom_text, str) and symptom_text.strip():
            symptom = Symptom.objects.filter(symptom_name=symptom_text.strip()).first()
            if symptom:
                PostSymptomsRelation.objects.get_or_create(post=abnormal_post, symptom=symptom)
                symptoms_added.append(symptom_text.strip())
            else:
                symptoms_not_found.append(symptom_text.strip())
    
    result = {
        "success": True,
        "message": f"Abnormal post created successfully for pet '{pet.pet_name}'",
        "note": "如需上傳圖片記錄寵物狀況，請在異常記錄建立後使用圖片上傳功能。",
        "abnormal_post_id": abnormal_post.id,
        "post_data": {
            "id": abnormal_post.id,
            "pet_id": pet.id,
            "pet_name": pet.pet_name,
            "content": abnormal_post.content,
            "weight": abnormal_post.weight,
            "body_temperature": abnormal_post.body_temperature,
            "water_amount": abnormal_post.water_amount,
            "is_emergency": abnormal_post.is_emergency,
            "record_date": abnormal_post.record_date.isoformat() if abnormal_post.record_date else None,
            "is_private": abnormal_post.is_private,
            "created_at": abnormal_post.created_at.isoformat(),
            "symptoms_added": symptoms_added,
            "status": "created_without_images"
        }
    }

    if symptoms_not_found:
        result["warning"] = f"Some symptoms were not found: {', '.join(symptoms_not_found)}"

    return result


@transaction.atomic
def update_abnormal_post(data: Dict) -> Dict:
    """Update an abnormal post"""
    required_fields = ["user_id", "post_id"]
    missing_fields = [f for f in required_fields if f not in data]
    if missing_fields:
        return {"error": f"Missing required fields: {', '.join(missing_fields)}"}
    
    try:
        user = CustomUser.objects.get(id=data["user_id"])
        abnormal_post = AbnormalPost.objects.get(id=data["post_id"], user=user)
    except CustomUser.DoesNotExist:
        return {"error": f"User with id {data['user_id']} not found"}
    except AbnormalPost.DoesNotExist:
        return {"error": f"Abnormal post not found or does not belong to user"}
    
    # Update fields
    updated_fields = []
    if "content" in data:
        abnormal_post.content = data["content"]
        updated_fields.append("content")
    if "weight" in data:
        abnormal_post.weight = float(data["weight"])
        updated_fields.append("weight")
    if "body_temperature" in data:
        abnormal_post.body_temperature = float(data["body_temperature"])
        updated_fields.append("body_temperature")
    if "water_amount" in data:
        abnormal_post.water_amount = int(data["water_amount"])
        updated_fields.append("water_amount")
    if "is_emergency" in data:
        abnormal_post.is_emergency = data["is_emergency"]
        updated_fields.append("is_emergency")
    if "is_private" in data:
        abnormal_post.is_private = data["is_private"]
        updated_fields.append("is_private")
    
    if updated_fields:
        abnormal_post.save(update_fields=updated_fields)
    
    # Update symptoms if provided
    if "symptoms" in data:
        PostSymptomsRelation.objects.filter(post=abnormal_post).delete()
        for symptom_name in data["symptoms"]:
            symptom = Symptom.objects.filter(symptom_name=symptom_name).first()
            if symptom:
                PostSymptomsRelation.objects.create(post=abnormal_post, symptom=symptom)
        updated_fields.append("symptoms")
    
    return {
        "success": True,
        "message": "Abnormal post updated successfully",
        "updated_fields": updated_fields,
        "post_id": abnormal_post.id
    }


@transaction.atomic
def delete_abnormal_post(data: Dict) -> Dict:
    """Delete an abnormal post"""
    required_fields = ["user_id", "post_id"]
    missing_fields = [f for f in required_fields if f not in data]
    if missing_fields:
        return {"error": f"Missing required fields: {', '.join(missing_fields)}"}
    
    try:
        user = CustomUser.objects.get(id=data["user_id"])
        abnormal_post = AbnormalPost.objects.get(id=data["post_id"], user=user)
    except CustomUser.DoesNotExist:
        return {"error": f"User with id {data['user_id']} not found"}
    except AbnormalPost.DoesNotExist:
        return {"error": "Abnormal post not found or does not belong to user"}
    
    post_id = abnormal_post.id
    pet_name = abnormal_post.pet.pet_name
    
    abnormal_post.delete()
    
    return {
        "success": True,
        "message": f"Abnormal post deleted successfully",
        "deleted_post_id": post_id,
        "pet_name": pet_name
    }


# ---------- Disease Archive Operations ----------

@transaction.atomic
def create_disease_archive(data: Dict) -> Dict:
    """Create disease archive from abnormal posts"""
    required_fields = ["user_id", "pet_id", "archive_title", "abnormal_post_ids"]
    missing_fields = [f for f in required_fields if f not in data]
    if missing_fields:
        return {"error": f"Missing required fields: {', '.join(missing_fields)}"}
    
    archive_title = data.get("archive_title", "").strip()
    content = data.get("content", "").strip()
    abnormal_post_ids = data.get("abnormal_post_ids", [])
    
    if not archive_title:
        return {"error": "Archive title cannot be empty"}
    if not abnormal_post_ids or not isinstance(abnormal_post_ids, list):
        return {"error": "At least one abnormal post ID is required"}
    
    try:
        user = CustomUser.objects.get(id=data["user_id"])
        pet = Pet.objects.get(id=data["pet_id"], owner=user)
    except CustomUser.DoesNotExist:
        return {"error": f"User with id {data['user_id']} not found"}
    except Pet.DoesNotExist:
        return {"error": f"Pet not found or does not belong to user"}
    
    # Validate abnormal posts
    abnormal_posts = AbnormalPost.objects.filter(
        id__in=abnormal_post_ids, pet=pet, user=user
    ).prefetch_related('symptoms__symptom').order_by('record_date')
    
    if abnormal_posts.count() != len(abnormal_post_ids):
        return {"error": "Some abnormal post IDs are invalid"}
    
    # Generate content if not provided
    if not content:
        content = generate_disease_archive_content(
            pet=pet,
            abnormal_posts=abnormal_posts,
            symptoms=data.get("symptoms", []),
            main_cause=data.get("main_cause", "")
        )
        if not content:
            return {"error": "Failed to generate archive content"}
    
    # Create PostFrame and DiseaseArchiveContent
    post_frame = PostFrame.objects.create(user=user)
    disease_archive = DiseaseArchiveContent.objects.create(
        archive_title=archive_title,
        content=content,
        go_to_doctor=data.get("go_to_doctor", False),
        health_status=data.get("health_status", ""),
        pet=pet,
        postFrame=post_frame,
        is_private=data.get("is_private", True)
    )
    
    # Create abnormal post relations
    archive_post_relations = [
        ArchiveAbnormalPostRelation(archive=disease_archive, post=post)
        for post in abnormal_posts
    ]
    ArchiveAbnormalPostRelation.objects.bulk_create(archive_post_relations)
    
    # Handle main cause
    main_cause = data.get("main_cause", "").strip()
    if main_cause:
        illness, _ = Illness.objects.get_or_create(illness_name=main_cause)
        ArchiveIllnessRelation.objects.create(archive=disease_archive, illness=illness)
    
    logger.info(f"Created disease archive {disease_archive.id} for pet {pet.id}")
    
    # Build response data
    from media.models import UserHeadshot
    
    return {
        "success": True,
        "message": f"Disease archive '{archive_title}' created successfully",
        "disease_archive_id": disease_archive.id,
        "archive_data": {
            "id": disease_archive.id,
            "pet_name": pet.pet_name,
            "archive_title": disease_archive.archive_title,
            "content": disease_archive.content,
            "was_auto_generated": not bool(data.get("content"))
        }
    }


# ---------- Social Post Operations ----------

@transaction.atomic
def create_social_post(data: Dict) -> Dict:
    """Create a social media post"""
    required_fields = ["user_id", "content", "has_images"]
    missing_fields = [f for f in required_fields if f not in data]
    if missing_fields:
        return {"error": f"Missing required fields: {', '.join(missing_fields)}"}
    
    if not data.get("has_images"):
        return {
            "error": "社群貼文需要至少一張圖片",
            "user_message": "發布社群貼文需要至少一張圖片。請先點擊聊天框左下角的相片按鈕選擇圖片。",
            "should_ask_user": True
        }
    
    try:
        user = CustomUser.objects.get(id=data["user_id"])
    except CustomUser.DoesNotExist:
        return {"error": f"User with id {data['user_id']} not found"}
    
    # Create PostFrame
    post_frame = PostFrame.objects.create(user=user)
    
    # Create SoLContent
    sol_content = SoLContent.objects.create(
        postFrame=post_frame,
        content=data["content"],
        location=data.get("location", "")
    )
    
    # Handle hashtags
    hashtags_str = data.get("hashtags", "")
    if hashtags_str:
        hashtag_list = [tag.strip().lstrip('#') for tag in hashtags_str.split(',') if tag.strip()]
        for tag_name in hashtag_list:
            if tag_name:
                hashtag, _ = PostHashtag.objects.get_or_create(hashtag_name=tag_name)
                sol_content.hashtags.add(hashtag)
    
    logger.info(f"Created social post {post_frame.id} for user {user.id}")
    
    return {
        "success": True,
        "message": "貼文建立成功！",
        "post_id": post_frame.id,
        "note": "圖片已由前端自動上傳。",
        "post_data": {
            "id": post_frame.id,
            "content": sol_content.content,
            "location": sol_content.location,
            "hashtags": hashtags_str,
            "created_at": post_frame.created_at.isoformat()
        }
    }


# ---------- Feed Operations ----------

def prepare_feed_ocr(data: Dict = None) -> Dict:
    """Prepare feed OCR analysis (triggers frontend OCR)"""
    return {
        "success": True,
        "message": "準備進行飼料 OCR 分析",
        "action": "請前端觸發 OCR 分析"
    }


@transaction.atomic
def add_feed(data: Dict) -> Dict:
    """Add new feed with nutrition information"""
    required_fields = ["user_id", "pet_type", "has_images", "name", "brand", "price"]
    nutrition_fields = ["protein", "fat", "carbohydrate", "calcium", "phosphorus", "magnesium", "sodium"]
    
    missing_fields = [f for f in required_fields if f not in data]
    if missing_fields:
        return {"error": f"Missing required fields: {', '.join(missing_fields)}"}
    
    if not data.get("has_images"):
        return {
            "error": "飼料資料需要圖片",
            "user_message": "新增飼料需要上傳 2 張圖片。",
            "should_ask_user": True
        }
    
    # Check for existing feed with same nutrition
    existing_feed = Feed.objects.filter(
        protein=data.get("protein", 0),
        fat=data.get("fat", 0),
        carbohydrate=data.get("carbohydrate", 0),
        calcium=data.get("calcium", 0),
        phosphorus=data.get("phosphorus", 0),
        magnesium=data.get("magnesium", 0),
        sodium=data.get("sodium", 0)
    ).first()
    
    if existing_feed:
        return {
            "success": True,
            "feed_id": existing_feed.id,
            "is_existing": True,
            "matched_feed": {
                "brand_name": existing_feed.brand_name,
                "product_line": existing_feed.product_line
            },
            "navigation": {
                "path": f"/feeds/{existing_feed.id}",
                "destination": "飼料詳情頁面"
            },
            "message": f"資料庫中已有符合的飼料：{existing_feed.brand_name} - {existing_feed.product_line}"
        }
    
    # Create new feed
    feed = Feed.objects.create(
        pet_type=data["pet_type"],
        brand_name=data["brand"],
        product_line=data["name"],
        price=data["price"],
        protein=data.get("protein", 0),
        fat=data.get("fat", 0),
        carbohydrate=data.get("carbohydrate", 0),
        calcium=data.get("calcium", 0),
        phosphorus=data.get("phosphorus", 0),
        magnesium=data.get("magnesium", 0),
        sodium=data.get("sodium", 0)
    )
    
    logger.info(f"Created feed {feed.id}")
    
    return {
        "success": True,
        "feed_id": feed.id,
        "is_existing": False,
        "message": "飼料資料建立成功！"
    }


# ---------- Plan Management Operations ----------

@transaction.atomic
def add_plan(data: Dict) -> Dict:
    """Add a new plan for a pet"""
    required_fields = ["user_id", "pet_id", "plan_name", "plan_date"]
    missing_fields = [f for f in required_fields if f not in data]
    if missing_fields:
        return {"error": f"Missing required fields: {', '.join(missing_fields)}"}
    
    try:
        user = CustomUser.objects.get(id=data["user_id"])
        pet = Pet.objects.get(id=data["pet_id"], owner=user)
    except CustomUser.DoesNotExist:
        return {"error": f"User not found"}
    except Pet.DoesNotExist:
        return {"error": "Pet not found or does not belong to user"}
    
    # Parse date
    try:
        plan_date = date.fromisoformat(data["plan_date"])
    except ValueError:
        return {"error": "Invalid date format"}
    
    # Check for existing plan
    if Plan.objects.filter(pet=pet, plan_date=plan_date, plan_name=data["plan_name"]).exists():
        return {"error": "A plan with this name already exists for this date"}
    
    # Parse time if provided
    plan_time = None
    if data.get("plan_time"):
        try:
            plan_time = time.fromisoformat(data["plan_time"])
        except ValueError:
            return {"error": "Invalid time format"}
    
    plan = Plan.objects.create(
        pet=pet,
        plan_name=data["plan_name"],
        plan_date=plan_date,
        plan_time=plan_time,
        is_completed=False
    )
    
    return {
        "success": True,
        "message": f"Plan '{plan.plan_name}' created successfully",
        "plan_id": plan.id,
        "plan_data": {
            "id": plan.id,
            "plan_name": plan.plan_name,
            "plan_date": plan.plan_date.isoformat(),
            "plan_time": plan.plan_time.isoformat() if plan.plan_time else None,
            "is_completed": plan.is_completed
        }
    }


@transaction.atomic
def complete_plan(data: Dict) -> Dict:
    """Mark a plan as completed"""
    required_fields = ["user_id", "plan_id"]
    missing_fields = [f for f in required_fields if f not in data]
    if missing_fields:
        return {"error": f"Missing required fields: {', '.join(missing_fields)}"}
    
    try:
        user = CustomUser.objects.get(id=data["user_id"])
        plan = Plan.objects.get(id=data["plan_id"], pet__owner=user)
    except CustomUser.DoesNotExist:
        return {"error": "User not found"}
    except Plan.DoesNotExist:
        return {"error": "Plan not found"}
    
    plan.is_completed = True
    plan.save(update_fields=["is_completed"])
    
    return {
        "success": True,
        "message": f"Plan '{plan.plan_name}' marked as completed",
        "plan_id": plan.id
    }


@transaction.atomic
def update_plan(data: Dict) -> Dict:
    """Update plan details"""
    required_fields = ["user_id", "plan_id"]
    missing_fields = [f for f in required_fields if f not in data]
    if missing_fields:
        return {"error": f"Missing required fields: {', '.join(missing_fields)}"}
    
    try:
        user = CustomUser.objects.get(id=data["user_id"])
        plan = Plan.objects.get(id=data["plan_id"], pet__owner=user)
    except CustomUser.DoesNotExist:
        return {"error": "User not found"}
    except Plan.DoesNotExist:
        return {"error": "Plan not found"}
    
    updated_fields = []
    if "plan_name" in data:
        plan.plan_name = data["plan_name"]
        updated_fields.append("plan_name")
    if "plan_date" in data:
        plan.plan_date = date.fromisoformat(data["plan_date"])
        updated_fields.append("plan_date")
    if "plan_time" in data:
        plan.plan_time = time.fromisoformat(data["plan_time"]) if data["plan_time"] else None
        updated_fields.append("plan_time")
    if "is_completed" in data:
        plan.is_completed = data["is_completed"]
        updated_fields.append("is_completed")
    
    if updated_fields:
        plan.save(update_fields=updated_fields)
    
    return {
        "success": True,
        "message": "Plan updated successfully",
        "updated_fields": updated_fields,
        "plan_id": plan.id
    }


@transaction.atomic
def delete_plan(data: Dict) -> Dict:
    """Delete a plan"""
    required_fields = ["user_id", "plan_id"]
    missing_fields = [f for f in required_fields if f not in data]
    if missing_fields:
        return {"error": f"Missing required fields: {', '.join(missing_fields)}"}
    
    try:
        user = CustomUser.objects.get(id=data["user_id"])
        plan = Plan.objects.get(id=data["plan_id"], pet__owner=user)
    except CustomUser.DoesNotExist:
        return {"error": "User not found"}
    except Plan.DoesNotExist:
        return {"error": "Plan not found"}
    
    plan_id = plan.id
    plan_name = plan.plan_name
    plan.delete()
    
    return {
        "success": True,
        "message": f"Plan '{plan_name}' deleted successfully",
        "deleted_plan_id": plan_id
    }


def list_plans(data: Dict) -> Dict:
    """List plans for a pet with optional filters"""
    required_fields = ["user_id", "pet_id"]
    missing_fields = [f for f in required_fields if f not in data]
    if missing_fields:
        return {"error": f"Missing required fields: {', '.join(missing_fields)}"}
    
    try:
        user = CustomUser.objects.get(id=data["user_id"])
        pet = Pet.objects.get(id=data["pet_id"], owner=user)
    except CustomUser.DoesNotExist:
        return {"error": "User not found"}
    except Pet.DoesNotExist:
        return {"error": "Pet not found"}
    
    queryset = Plan.objects.filter(pet=pet)
    
    # Apply filters
    if "start_date" in data:
        queryset = queryset.filter(plan_date__gte=date.fromisoformat(data["start_date"]))
    if "end_date" in data:
        queryset = queryset.filter(plan_date__lte=date.fromisoformat(data["end_date"]))
    if "is_completed" in data:
        queryset = queryset.filter(is_completed=data["is_completed"])
    
    plans = queryset.order_by('plan_date', 'plan_time')
    
    plans_data = [{
        "id": plan.id,
        "plan_name": plan.plan_name,
        "plan_date": plan.plan_date.isoformat(),
        "plan_time": plan.plan_time.isoformat() if plan.plan_time else None,
        "is_completed": plan.is_completed
    } for plan in plans]
    
    return {
        "success": True,
        "count": len(plans_data),
        "plans": plans_data
    }


# ---------- Health Report Operations ----------

def prepare_health_report_ocr(data: Dict = None) -> Dict:
    """Prepare health report OCR analysis"""
    return {
        "success": True,
        "message": "準備進行健康報告 OCR 分析",
        "action": "請前端觸發 OCR 分析"
    }


@transaction.atomic
def add_health_report(data: Dict) -> Dict:
    """Add a new health report"""
    required_fields = ["user_id", "pet_id", "check_type", "check_date"]
    missing_fields = [f for f in required_fields if f not in data]
    if missing_fields:
        return {"error": f"Missing required fields: {', '.join(missing_fields)}"}
    
    try:
        user = CustomUser.objects.get(id=data["user_id"])
        pet = Pet.objects.get(id=data["pet_id"], owner=user)
    except CustomUser.DoesNotExist:
        return {"error": "User not found"}
    except Pet.DoesNotExist:
        return {"error": "Pet not found"}
    
    # Parse date
    try:
        check_date = date.fromisoformat(data["check_date"])
    except ValueError:
        return {"error": "Invalid date format"}
    
    report = HealthReport.objects.create(
        pet=pet,
        check_type=data["check_type"],
        check_date=check_date,
        check_location=data.get("check_location", "")
    )
    
    return {
        "success": True,
        "message": "Health report created successfully",
        "report_id": report.id,
        "report_data": {
            "id": report.id,
            "pet_id": pet.id,
            "check_type": report.check_type,
            "check_date": report.check_date.isoformat()
        }
    }


@transaction.atomic
def update_health_report(data: Dict) -> Dict:
    """Update a health report"""
    required_fields = ["user_id", "report_id"]
    missing_fields = [f for f in required_fields if f not in data]
    if missing_fields:
        return {"error": f"Missing required fields: {', '.join(missing_fields)}"}
    
    try:
        user = CustomUser.objects.get(id=data["user_id"])
        report = HealthReport.objects.get(id=data["report_id"], pet__owner=user)
    except CustomUser.DoesNotExist:
        return {"error": "User not found"}
    except HealthReport.DoesNotExist:
        return {"error": "Health report not found"}
    
    updated_fields = []
    if "check_type" in data:
        report.check_type = data["check_type"]
        updated_fields.append("check_type")
    if "check_date" in data:
        report.check_date = date.fromisoformat(data["check_date"])
        updated_fields.append("check_date")
    if "check_location" in data:
        report.check_location = data["check_location"]
        updated_fields.append("check_location")
    
    if updated_fields:
        report.save(update_fields=updated_fields)
    
    return {
        "success": True,
        "message": "Health report updated successfully",
        "updated_fields": updated_fields,
        "report_id": report.id
    }


@transaction.atomic
def delete_health_report(data: Dict) -> Dict:
    """Delete a health report"""
    required_fields = ["user_id", "report_id"]
    missing_fields = [f for f in required_fields if f not in data]
    if missing_fields:
        return {"error": f"Missing required fields: {', '.join(missing_fields)}"}
    
    try:
        user = CustomUser.objects.get(id=data["user_id"])
        report = HealthReport.objects.get(id=data["report_id"], pet__owner=user)
    except CustomUser.DoesNotExist:
        return {"error": "User not found"}
    except HealthReport.DoesNotExist:
        return {"error": "Health report not found"}
    
    report_id = report.id
    report.delete()
    
    return {
        "success": True,
        "message": "Health report deleted successfully",
        "deleted_report_id": report_id
    }


# ============================================================================
#                            SECTION 4: Helper Functions
# ============================================================================
"""
This section contains helper functions used by write operations:
- AI content generation for disease archives
- Utility functions for data processing
"""

def generate_disease_archive_content(pet, abnormal_posts, symptoms, main_cause):
    """
    Generate disease archive content using GPT
    
    Args:
        pet: Pet object
        abnormal_posts: QuerySet of AbnormalPost
        symptoms: List of symptoms
        main_cause: Main cause of illness
        
    Returns:
        Generated content string or None if failed
    """
    try:
        from openai import OpenAI
        import os
        
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            logger.error("[generate_disease_archive_content] OpenAI API key not found")
            return None
            
        client = OpenAI(api_key=api_key)
        
        # Prepare pet info
        pet_info = f"{pet.pet_name}（{pet.pet_type}，{pet.age}歲）"
        
        # Prepare symptoms
        symptom_list = symptoms if isinstance(symptoms, list) else []
        symptoms_text = '、'.join(symptom_list) if symptom_list else '未指定'
        
        # Prepare abnormal posts data
        posts_data = []
        for post in abnormal_posts:
            post_symptoms = [rel.symptom.symptom_name for rel in post.symptoms.all()]
            post_data = {
                'date': post.record_date.strftime('%Y年%m月%d日'),
                'symptoms': '、'.join(post_symptoms) if post_symptoms else '無症狀記錄',
                'content': post.content or '無補充描述',
                'weight': f"{post.weight}公斤" if post.weight else '未記錄',
                'body_temperature': f"{post.body_temperature}度" if post.body_temperature else '未記錄',
                'water_amount': f"{post.water_amount/1000}公升" if post.water_amount else '未記錄',
                'is_emergency': '是就醫記錄' if post.is_emergency else '非就醫記錄'
            }
            posts_data.append(post_data)
        
        # Build detailed posts text
        posts_detail = "\n\n".join([
            f"【{post['date']}】\n"
            f"症狀: {post['symptoms']}\n"
            f"補充描述: {post['content']}\n"
            f"體重: {post['weight']}\n"
            f"體溫: {post['body_temperature']}\n"
            f"喝水量: {post['water_amount']}\n"
            f"就醫情況: {post['is_emergency']}"
            for post in posts_data
        ])
        
        # Calculate duration
        duration = f"從{posts_data[0]['date']}到{posts_data[-1]['date']}" if len(posts_data) > 1 else posts_data[0]['date']
        
        # Build prompt
        prompt = f"""請幫我整理以下寵物的疾病檔案資料：

寵物基本資訊：
{pet_info}

主要病因：{main_cause or '未指定主要病因'}
主要症狀：{symptoms_text}
病程時間：{duration}

詳細異常記錄：
{posts_detail}

請按照以下要求整理：
1. 繁體中文撰寫
2. 時間順序整理病程
3. 每筆記錄使用明確日期標題「X月X日」
4. 第一人稱主人視角
5. 親切自然語調
6. 詳細但簡潔
7. 純文字格式
8. 不加標題前綴"""
        
        logger.info("[generate_disease_archive_content] Calling GPT API...")
        
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": "你是專業的寵物醫療記錄整理師。用繁體中文、第一人稱主人視角、親切自然語調撰寫，純文字格式。"
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=2000
        )
        
        generated_content = response.choices[0].message.content.strip()
        logger.info(f"[generate_disease_archive_content] Generated {len(generated_content)} chars")
        
        return generated_content
        
    except Exception as e:
        logger.error(f"[generate_disease_archive_content] Failed: {str(e)}", exc_info=True)
        return None


# ============================================================================
# ============================================================================
#                            Unified Operation Registry & Public API
# ============================================================================
"""
Unified registry for ALL operations (query + write) with public API functions.
This must come after Section 4 where the functions are defined.
"""

OPERATION_REGISTRY = {
    # ---------- Query Operations (Read-Only) ----------
    "query:social_post": lambda user_id, conditions, limit=5: get_social_posts(user_id, conditions, limit),
    "query:feed": lambda user_id, conditions, limit=5: get_pet_foods_details(conditions, limit, return_with_paths=True),
    "query:pet": lambda user_id, conditions, limit=5: get_user_pet_list(user_id, conditions, limit, return_with_paths=True),
    "query:user": lambda user_id, conditions, limit=5: get_user_information(user_ids=None, conditions=conditions, limit=limit, return_with_paths=True),
    "query:health_report": lambda user_id, conditions, limit=5: get_health_reports(user_id, conditions, limit),
    "query:disease_archive": lambda user_id, conditions, limit=5: get_disease_archives(user_id, conditions, limit),
    "query:abnormal_post": lambda user_id, conditions, limit=5: get_abnormal_posts(user_id, conditions, limit),
    "query:search_query": lambda user_id, conditions, limit=5: generate_search_query(conditions),
    
    # ---------- Write Operations (Create/Update/Delete) ----------
    # Pet operations
    "add_pet": add_pet,
    "update_pet": update_pet,
    
    # User operations
    "update_user": update_user,
    "update_user_headshot": update_user_headshot,
    
    # Health record operations
    "add_abnormal_post": add_abnormal_post,
    "update_abnormal_post": update_abnormal_post,
    "delete_abnormal_post": delete_abnormal_post,
    
    # Disease archive operations
    "create_disease_archive": create_disease_archive,
    
    # Social operations
    "create_social_post": create_social_post,
    
    # Feed operations
    "add_feed": add_feed,
    "prepare_feed_ocr": prepare_feed_ocr,
    
    # Plan operations
    "add_plan": add_plan,
    "complete_plan": complete_plan,
    "update_plan": update_plan,
    "delete_plan": delete_plan,
    "list_plans": list_plans,
    
    # Health report operations
    "add_health_report": add_health_report,
    "update_health_report": update_health_report,
    "delete_health_report": delete_health_report,
    "prepare_health_report_ocr": prepare_health_report_ocr,
}

# List of supported query entity types
QUERY_ENTITY_TYPES = [
    "social_post", "feed", "pet", "user",
    "health_report", "disease_archive", "abnormal_post", "search_query"
]


# ---------- Unified Public API Functions ----------

def perform_operation(operation_type: str, operation: str = None, data: Dict = None, **kwargs) -> Dict:
    """
    Unified entry point for ALL database operations (read and write)
    
    Args:
        operation_type: Type of operation - "query" or "write"
        operation: For "write" - operation name (e.g., "add_pet")
                  For "query" - entity type (e.g., "pet", "feed")
        data: Operation/query parameters (for write operations)
        **kwargs: Additional parameters for query operations (user_id, conditions, limit)
        
    Returns:
        Operation result dictionary
        
    Examples:
        # Write operation
        perform_operation("write", "add_pet", {"user_id": 1, "pet_name": "Buddy", ...})
        
        # Query operation
        perform_operation("query", "pet", user_id=1, conditions={"pet_name": "Buddy"}, limit=5)
    """
    try:
        logger.info(f"[perform_operation] Type: {operation_type}, Operation: {operation}")
        
        if operation_type == "write":
            # Write operations (create/update/delete)
            if operation not in OPERATION_REGISTRY:
                error_msg = f"Write operation '{operation}' is not implemented"
                logger.error(f"[perform_operation] {error_msg}")
                return {"error": error_msg}
            
            operation_func = OPERATION_REGISTRY[operation]
            result = operation_func(data or {})
            logger.info(f"[perform_operation] Write completed: success={result.get('success')}")
            return result
            
        elif operation_type == "query":
            # Query operations (entity resolution)
            if operation not in QUERY_ENTITY_TYPES:
                error_msg = f"Query entity type '{operation}' is not supported"
                logger.error(f"[perform_operation] {error_msg}")
                return {
                    "success": False,
                    "error": error_msg,
                    "supported_types": QUERY_ENTITY_TYPES
                }
            
            user_id = kwargs.get("user_id")
            conditions = kwargs.get("conditions", {})
            limit = kwargs.get("limit", 5)
            
            # Look up query operation in registry
            query_key = f"query:{operation}"
            query_func = OPERATION_REGISTRY[query_key]
            result = query_func(user_id, conditions, limit)
            
            logger.info(f"[perform_operation] Query completed: count={result.get('count', 0)}")
            return result
            
        else:
            error_msg = f"Invalid operation_type: {operation_type}. Must be 'query' or 'write'"
            logger.error(f"[perform_operation] {error_msg}")
            return {"error": error_msg}
            
    except Exception as e:
        error_msg = f"Failed to perform operation: {str(e)}"
        logger.error(f"[perform_operation] Exception: {error_msg}", exc_info=True)
        return {"error": error_msg}


def get_operation_list() -> Dict:
    """
    Get list of all available database operations with metadata
    
    Returns:
        Dictionary containing operation definitions and parameters
    """
    
    operations = {
        # ---------- Query Operations ----------
        "query:social_post": {
            "description": "查詢社群貼文",
            "type": "query",
            "required_params": ["user_id"],
            "optional_params": ["conditions", "limit"]
        },
        "query:feed": {
            "description": "查詢飼料資料",
            "type": "query",
            "required_params": [],
            "optional_params": ["user_id", "conditions", "limit"]
        },
        "query:pet": {
            "description": "查詢寵物資料",
            "type": "query",
            "required_params": ["user_id"],
            "optional_params": ["conditions", "limit"]
        },
        "query:user": {
            "description": "查詢用戶資料",
            "type": "query",
            "required_params": [],
            "optional_params": ["user_id", "conditions", "limit"]
        },
        "query:health_report": {
            "description": "查詢健康報告",
            "type": "query",
            "required_params": ["user_id"],
            "optional_params": ["conditions", "limit"]
        },
        "query:disease_archive": {
            "description": "查詢疾病檔案",
            "type": "query",
            "required_params": ["user_id"],
            "optional_params": ["conditions", "limit"]
        },
        "query:abnormal_post": {
            "description": "查詢異常記錄",
            "type": "query",
            "required_params": ["user_id"],
            "optional_params": ["conditions", "limit"]
        },
        "query:search_query": {
            "description": "生成搜尋查詢路徑",
            "type": "query",
            "required_params": ["conditions"],
            "optional_params": []
        },
        
        # ---------- Write Operations ----------
        # Pet operations
        "add_pet": {
            "description": "新增寵物",
            "type": "write",
            "required_params": ["user_id", "pet_name", "pet_type", "weight", "pet_stage"],
            "optional_params": ["age", "breed", "predicted_adult_weight", "description", "height", "weeks_of_lactation"]
        },
        "update_pet": {
            "description": "更新寵物資訊",
            "type": "write",
            "required_params": ["pet_id"],
            "optional_params": ["owner", "weight", "pet_stage", "age", "pet_name", "breed", "pet_type"]
        },
        
        # User operations
        "update_user": {
            "description": "更新用戶資訊",
            "type": "write",
            "required_params": ["user_id"],
            "optional_params": ["username", "user_fullname", "bio", "account_privacy"]
        },
        "update_user_headshot": {
            "description": "更新用戶頭像",
            "type": "write",
            "required_params": ["user_id", "has_image"],
            "optional_params": []
        },
        
        # Health record operations
        "add_abnormal_post": {
            "description": "新增異常記錄",
            "type": "write",
            "required_params": ["user_id", "pet_id", "symptoms"],
            "optional_params": ["content", "weight", "body_temperature", "water_amount", "is_emergency", "record_date"]
        },
        "update_abnormal_post": {
            "description": "更新異常記錄",
            "type": "write",
            "required_params": ["user_id", "post_id"],
            "optional_params": ["symptoms", "content", "weight", "body_temperature", "water_amount", "is_emergency", "is_private"]
        },
        "delete_abnormal_post": {
            "description": "刪除異常記錄",
            "type": "write",
            "required_params": ["user_id", "post_id"],
            "optional_params": []
        },
        
        # Disease archive operations
        "create_disease_archive": {
            "description": "建立疾病檔案",
            "type": "write",
            "required_params": ["user_id", "pet_id", "archive_title", "abnormal_post_ids"],
            "optional_params": ["content", "symptoms", "main_cause", "go_to_doctor", "health_status"]
        },
        
        # Social operations
        "create_social_post": {
            "description": "建立社群貼文",
            "type": "write",
            "required_params": ["user_id", "content", "has_images"],
            "optional_params": ["location", "hashtags"]
        },
        
        # Feed operations
        "add_feed": {
            "description": "新增飼料資料",
            "type": "write",
            "required_params": ["user_id", "pet_type", "has_images", "name", "brand", "price"],
            "optional_params": ["protein", "fat", "carbohydrate", "calcium", "phosphorus", "magnesium", "sodium"]
        },
        "prepare_feed_ocr": {
            "description": "準備飼料OCR處理",
            "type": "write",
            "required_params": [],
            "optional_params": []
        },
        
        # Plan operations
        "add_plan": {
            "description": "新增計劃",
            "type": "write",
            "required_params": ["user_id", "pet_id", "plan_name", "plan_date"],
            "optional_params": ["plan_time"]
        },
        "complete_plan": {
            "description": "完成計劃",
            "type": "write",
            "required_params": ["user_id", "plan_id"],
            "optional_params": []
        },
        "update_plan": {
            "description": "更新計劃",
            "type": "write",
            "required_params": ["user_id", "plan_id"],
            "optional_params": ["plan_name", "plan_date", "plan_time", "is_completed"]
        },
        "delete_plan": {
            "description": "刪除計劃",
            "type": "write",
            "required_params": ["user_id", "plan_id"],
            "optional_params": []
        },
        "list_plans": {
            "description": "列出計劃",
            "type": "write",
            "required_params": ["user_id", "pet_id"],
            "optional_params": ["start_date", "end_date", "is_completed"]
        },
        
        # Health report operations
        "add_health_report": {
            "description": "新增健康報告",
            "type": "write",
            "required_params": ["user_id", "pet_id", "check_type", "check_date"],
            "optional_params": ["check_location"]
        },
        "update_health_report": {
            "description": "更新健康報告",
            "type": "write",
            "required_params": ["user_id", "report_id"],
            "optional_params": ["check_type", "check_date", "check_location"]
        },
        "delete_health_report": {
            "description": "刪除健康報告",
            "type": "write",
            "required_params": ["user_id", "report_id"],
            "optional_params": []
        },
        "prepare_health_report_ocr": {
            "description": "準備健康報告OCR處理",
            "type": "write",
            "required_params": [],
            "optional_params": []
        }
    }
    
    return {
        "operations": operations,
        "total_count": len(operations),
        "query_count": len([k for k in operations.keys() if k.startswith("query:")]),
        "write_count": len([k for k in operations.keys() if not k.startswith("query:")]),
        "available_operations": list(OPERATION_REGISTRY.keys())
    }


# ============================================================================
# END OF OPERATION CONNECTOR MODULE
# ============================================================================
