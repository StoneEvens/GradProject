"""
統一的實體解析器 - 用於處理動態路徑的參數查詢

這個模組提供統一的接口來查詢各種實體（貼文、飼料、寵物等）
支援自然語言描述的條件查詢
"""

from typing import Dict, Optional, List, Literal
from datetime import datetime, timedelta
from django.db.models import Q
from django.utils import timezone
from asgiref.sync import sync_to_async

from social.models import PostFrame, SoLContent
from feeds.models import Feed
from pets.models import Pet, AbnormalPost, DiseaseArchiveContent
from ocrapp.models import HealthReport
from accounts.models import CustomUser


class EntityResolver:
    """統一的實體解析器"""

    ENTITY_TYPES = [
        "social_post",      # 社群貼文
        "feed",             # 飼料
        "pet",              # 寵物
        "user",             # 用戶
        "health_report",    # 健康報告
        "disease_archive",  # 疾病檔案
        "abnormal_post",    # 異常記錄
        "search_query",     # 搜尋查詢
    ]

    @staticmethod
    async def resolve(
        entity_type: str,
        user_id: int,
        conditions: Dict,
        limit: int = 5
    ) -> Dict:
        """
        統一的實體解析入口

        Args:
            entity_type: 實體類型（social_post, feed, pet 等）
            user_id: 當前用戶 ID
            conditions: 查詢條件字典
            limit: 返回結果數量限制

        Returns:
            包含查詢結果的字典
        """

        # 驗證實體類型
        if entity_type not in EntityResolver.ENTITY_TYPES:
            return {
                "success": False,
                "error": f"Unsupported entity type: {entity_type}",
                "supported_types": EntityResolver.ENTITY_TYPES
            }

        # 根據實體類型分發到對應的處理函數
        resolver_map = {
            "social_post": EntityResolver._resolve_social_post,
            "feed": EntityResolver._resolve_feed,
            "pet": EntityResolver._resolve_pet,
            "user": EntityResolver._resolve_user,
            "health_report": EntityResolver._resolve_health_report,
            "disease_archive": EntityResolver._resolve_disease_archive,
            "abnormal_post": EntityResolver._resolve_abnormal_post,
            "search_query": EntityResolver._resolve_search_query,
        }

        resolver_func = resolver_map[entity_type]
        return await resolver_func(user_id, conditions, limit)

    # ==================== 社群貼文解析 ====================

    @staticmethod
    async def _resolve_social_post(user_id: int, conditions: Dict, limit: int) -> Dict:
        """
        解析社群貼文查詢

        支援條件：
        - time_range: "last_week", "last_month", "today", "yesterday"
        - specific_date: "2025-11-03"
        - keywords: ["關鍵字1", "關鍵字2"]
        - order_by: "latest", "oldest", "most_liked"
        """

        @sync_to_async
        def query():
            try:
                # 基礎查詢：用戶自己的貼文
                queryset = PostFrame.objects.filter(author_id=user_id)

                # 時間範圍篩選
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
                        # 找到上個星期天
                        days_since_sunday = (now.weekday() + 1) % 7
                        if days_since_sunday == 0:
                            days_since_sunday = 7
                        last_sunday = (now - timedelta(days=days_since_sunday)).replace(hour=0, minute=0, second=0)
                        next_day = last_sunday + timedelta(days=1)
                        queryset = queryset.filter(created_at__gte=last_sunday, created_at__lt=next_day)

                # 特定日期篩選
                if "specific_date" in conditions:
                    date_str = conditions["specific_date"]
                    target_date = datetime.strptime(date_str, "%Y-%m-%d")
                    next_day = target_date + timedelta(days=1)
                    queryset = queryset.filter(
                        created_at__gte=target_date,
                        created_at__lt=next_day
                    )

                # 關鍵字搜索
                if "keywords" in conditions:
                    keywords = conditions["keywords"]
                    q_objects = Q()
                    for keyword in keywords:
                        q_objects |= Q(content__content__icontains=keyword)
                    queryset = queryset.filter(q_objects)

                # 排序
                order_by = conditions.get("order_by", "latest")
                if order_by == "latest":
                    queryset = queryset.order_by("-created_at")
                elif order_by == "oldest":
                    queryset = queryset.order_by("created_at")
                elif order_by == "most_liked":
                    queryset = queryset.order_by("-likes_count")

                # 限制數量
                posts = queryset[:limit]

                # 構建返回結果
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
                return {
                    "success": False,
                    "error": f"查詢社群貼文失敗: {str(e)}"
                }

        return await query()

    # ==================== 飼料解析 ====================

    @staticmethod
    async def _resolve_feed(user_id: int, conditions: Dict, limit: int) -> Dict:
        """
        解析飼料查詢

        支援條件：
        - usage: "last_viewed", "most_viewed", "marked"
        - keywords: ["品牌名", "類型"]
        - pet_type: "dog", "cat"
        """

        @sync_to_async
        def query():
            try:
                queryset = Feed.objects.all()

                # 寵物類型篩選
                if "pet_type" in conditions:
                    pet_type = conditions["pet_type"]
                    queryset = queryset.filter(pet_type__iexact=pet_type)

                # 關鍵字搜索
                if "keywords" in conditions:
                    keywords = conditions["keywords"]
                    q_objects = Q()
                    for keyword in keywords:
                        q_objects |= Q(brand_name__icontains=keyword) | Q(product_line__icontains=keyword)
                    queryset = queryset.filter(q_objects)

                # 使用情況（需要額外的用戶互動數據，這裡先簡化）
                if "usage" in conditions:
                    usage = conditions["usage"]
                    if usage == "marked":
                        # 假設有收藏關聯，這裡需要根據實際模型調整
                        pass

                # 排序
                order_by = conditions.get("order_by", "latest")
                if order_by == "latest":
                    queryset = queryset.order_by("-id")

                feeds = queryset[:limit]

                results = []
                for feed in feeds:
                    results.append({
                        "id": feed.id,
                        "brand_name": feed.brand_name,
                        "product_line": feed.product_line,
                        "pet_type": feed.pet_type,
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

            except Exception as e:
                return {
                    "success": False,
                    "error": f"查詢飼料失敗: {str(e)}"
                }

        return await query()

    # ==================== 寵物解析 ====================

    @staticmethod
    async def _resolve_pet(user_id: int, conditions: Dict, limit: int) -> Dict:
        """
        解析寵物查詢

        支援條件：
        - pet_name: "寵物名字"
        - pet_type: "dog", "cat"
        - newest: True (最新添加的)
        - oldest: True (最早添加的)
        """

        @sync_to_async
        def query():
            try:
                queryset = Pet.objects.filter(owner_id=user_id)

                # 名字搜索
                if "pet_name" in conditions:
                    queryset = queryset.filter(pet_name__icontains=conditions["pet_name"])

                # 類型篩選
                if "pet_type" in conditions:
                    queryset = queryset.filter(pet_type=conditions["pet_type"])

                # 排序
                if conditions.get("newest"):
                    queryset = queryset.order_by("-id")
                elif conditions.get("oldest"):
                    queryset = queryset.order_by("id")

                pets = queryset[:limit]

                results = []
                for pet in pets:
                    results.append({
                        "id": pet.id,
                        "pet_name": pet.pet_name,
                        "pet_type": pet.pet_type,
                        "breed": pet.breed,
                        "path_template": "/pet/{id}/edit",
                        "resolved_path": f"/pet/{pet.id}/edit"
                    })

                return {
                    "success": True,
                    "entity_type": "pet",
                    "count": len(results),
                    "results": results,
                    "message": f"找到 {len(results)} 隻符合條件的寵物"
                }

            except Exception as e:
                return {
                    "success": False,
                    "error": f"查詢寵物失敗: {str(e)}"
                }

        return await query()

    # ==================== 用戶解析 ====================

    @staticmethod
    async def _resolve_user(user_id: int, conditions: Dict, limit: int) -> Dict:
        """
        解析用戶查詢

        支援條件：
        - username: "用戶名"
        - keywords: ["搜索關鍵字"]
        """

        @sync_to_async
        def query():
            try:
                queryset = CustomUser.objects.filter(account_privacy='public')

                # 用戶名搜索
                if "username" in conditions:
                    queryset = queryset.filter(username__icontains=conditions["username"])

                # 關鍵字搜索
                if "keywords" in conditions:
                    keywords = conditions["keywords"]
                    q_objects = Q()
                    for keyword in keywords:
                        q_objects |= Q(username__icontains=keyword) | Q(email__icontains=keyword)
                    queryset = queryset.filter(q_objects)

                users = queryset[:limit]

                results = []
                for user in users:
                    results.append({
                        "id": user.id,
                        "username": user.username,
                        "email": user.email,
                        "path_template": "/user/{username}",
                        "resolved_path": f"/user/{user.username}"
                    })

                return {
                    "success": True,
                    "entity_type": "user",
                    "count": len(results),
                    "results": results,
                    "message": f"找到 {len(results)} 位符合條件的用戶"
                }

            except Exception as e:
                return {
                    "success": False,
                    "error": f"查詢用戶失敗: {str(e)}"
                }

        return await query()

    # ==================== 健康報告解析 ====================

    @staticmethod
    async def _resolve_health_report(user_id: int, conditions: Dict, limit: int) -> Dict:
        """
        解析健康報告查詢

        支援條件：
        - pet_id: 寵物 ID
        - time_range: "last_week", "last_month"
        - newest: True
        """

        @sync_to_async
        def query():
            try:
                # 需要先獲取用戶的寵物
                user_pets = Pet.objects.filter(owner_id=user_id).values_list('id', flat=True)
                queryset = HealthReport.objects.filter(pet_id__in=user_pets)

                # 特定寵物
                if "pet_id" in conditions:
                    queryset = queryset.filter(pet_id=conditions["pet_id"])

                # 時間範圍
                if "time_range" in conditions:
                    time_range = conditions["time_range"]
                    now = timezone.now()

                    if time_range == "last_week":
                        start = now - timedelta(days=7)
                        queryset = queryset.filter(created_at__gte=start)
                    elif time_range == "last_month":
                        start = now - timedelta(days=30)
                        queryset = queryset.filter(created_at__gte=start)

                # 排序
                if conditions.get("newest"):
                    queryset = queryset.order_by("-created_at")
                else:
                    queryset = queryset.order_by("-created_at")

                reports = queryset[:limit]

                results = []
                for report in reports:
                    # 檢查類型中文對照
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
                return {
                    "success": False,
                    "error": f"查詢健康報告失敗: {str(e)}"
                }

        return await query()

    # ==================== 疾病檔案解析 ====================

    @staticmethod
    async def _resolve_disease_archive(user_id: int, conditions: Dict, limit: int) -> Dict:
        """解析疾病檔案查詢"""

        @sync_to_async
        def query():
            try:
                user_pets = Pet.objects.filter(owner_id=user_id).values_list('id', flat=True)
                queryset = DiseaseArchiveContent.objects.filter(pet_id__in=user_pets)

                if "pet_id" in conditions:
                    queryset = queryset.filter(pet_id=conditions["pet_id"])

                queryset = queryset.order_by("-created_at")
                archives = queryset[:limit]

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
                return {
                    "success": False,
                    "error": f"查詢疾病檔案失敗: {str(e)}"
                }

        return await query()

    # ==================== 異常記錄解析 ====================

    @staticmethod
    async def _resolve_abnormal_post(user_id: int, conditions: Dict, limit: int) -> Dict:
        """解析異常記錄查詢"""

        @sync_to_async
        def query():
            try:
                user_pets = Pet.objects.filter(owner_id=user_id).values_list('id', flat=True)
                queryset = AbnormalPost.objects.filter(pet_id__in=user_pets)

                if "pet_id" in conditions:
                    queryset = queryset.filter(pet_id=conditions["pet_id"])

                queryset = queryset.order_by("-created_at")
                posts = queryset[:limit]

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
                return {
                    "success": False,
                    "error": f"查詢異常記錄失敗: {str(e)}"
                }

        return await query()

    # ==================== 搜尋查詢解析 ====================

    @staticmethod
    async def _resolve_search_query(user_id: int, conditions: Dict, limit: int) -> Dict:
        """
        解析搜尋查詢，生成搜尋路徑

        支援條件：
        - search_type: "social", "feed"（必需）
        - keywords: ["關鍵字1", "關鍵字2"]（必需）
        - description: "自然語言描述"（可選，用於生成更友善的提示）

        範例：
        conditions = {
            "search_type": "social",
            "keywords": ["貓咪", "生病"]
        }
        → 返回 /social?q=貓咪 生病

        conditions = {
            "search_type": "feed",
            "keywords": ["皇家", "狗"]
        }
        → 返回 /feeds/search?q=皇家 狗
        """

        @sync_to_async
        def query():
            try:
                # 獲取搜尋類型
                search_type = conditions.get("search_type")
                if not search_type:
                    return {
                        "success": False,
                        "error": "必須指定 search_type (social 或 feed)"
                    }

                # 獲取關鍵字
                keywords = conditions.get("keywords", [])
                if not keywords:
                    return {
                        "success": False,
                        "error": "必須提供至少一個關鍵字"
                    }

                # 將關鍵字組合成查詢字符串
                query_string = " ".join(keywords)

                # 根據搜尋類型生成路徑
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

                # 獲取描述（如果有）
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
                return {
                    "success": False,
                    "error": f"解析搜尋查詢失敗: {str(e)}"
                }

        return await query()
