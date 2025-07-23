"""
媒體檔案相關的 API Views - Firebase Storage 版本
"""

import logging
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import status as drf_status
from django.shortcuts import get_object_or_404
from django.db import transaction

from utils.api_response import APIResponse
from .models import Image, UserHeadshot, PetHeadshot
from .serializers import ImageSerializer, UserHeadshotSerializer, PetHeadshotSerializer
from pets.models import Pet
from social.models import PostFrame
from utils.image_service import ImageService

logger = logging.getLogger(__name__)


class ImageListAPIView(APIView):
    """圖片列表 API"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """
        獲取圖片列表
        
        Query Parameters:
        - content_type_id: 內容類型 ID (選填)
        - object_id: 對象 ID (選填)
        """
        content_type_id = request.query_params.get('content_type_id')
        object_id = request.query_params.get('object_id')
        
        queryset = Image.objects.all()
        
        if content_type_id:
            queryset = queryset.filter(content_type_id=content_type_id)
        if object_id:
            queryset = queryset.filter(object_id=object_id)
            
        queryset = queryset.order_by('sort_order')
        serializer = ImageSerializer(queryset, many=True)
        
        return APIResponse(
            data=serializer.data,
            message="圖片列表獲取成功"
        )


class ImageUploadAPIView(APIView):
    """通用圖片上傳 API - 待實作 Firebase Storage"""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    def post(self, request):
        """
        上傳圖片到 Firebase Storage（待實作）
        
        POST 數據:
        - image: 圖片檔案 (必填)
        - content_type_id: ContentType ID (必填)
        - object_id: 對象 ID (必填)
        - alt_text: 替代文字 (選填)
        - sort_order: 排序 (選填, 預設 0)
        """
        return APIResponse(
            message="Firebase Storage 圖片上傳功能開發中，請稍後再試",
            code=drf_status.HTTP_501_NOT_IMPLEMENTED,
            status=drf_status.HTTP_501_NOT_IMPLEMENTED
        )


class UserAvatarUploadAPIView(APIView):
    """用戶頭像上傳 API - 待實作 Firebase Storage"""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    def post(self, request):
        """
        上傳用戶頭像到 Firebase Storage（待實作）
        
        POST 數據:
        - avatar: 頭像圖片檔案 (必填)
        """
        return APIResponse(
            message="Firebase Storage 頭像上傳功能開發中，請稍後再試",
            code=drf_status.HTTP_501_NOT_IMPLEMENTED,
            status=drf_status.HTTP_501_NOT_IMPLEMENTED
        )


class PetPhotoUploadAPIView(APIView):
    """寵物照片上傳 API - 待實作 Firebase Storage"""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    def post(self, request, pet_id):
        """
        上傳寵物照片到 Firebase Storage（待實作）
        
        POST 數據:
        - photo: 寵物照片檔案 (必填)
        - photo_type: 照片類型 (headshot/general, 預設 headshot)
        """
        # 驗證寵物是否存在且屬於當前用戶
        try:
            pet = Pet.objects.get(id=pet_id, user=request.user)
        except Pet.DoesNotExist:
            return APIResponse(
                message="寵物不存在或無權限",
                code=drf_status.HTTP_404_NOT_FOUND,
                status=drf_status.HTTP_404_NOT_FOUND
            )
        
        return APIResponse(
            message="Firebase Storage 寵物照片上傳功能開發中，請稍後再試",
            code=drf_status.HTTP_501_NOT_IMPLEMENTED,
            status=drf_status.HTTP_501_NOT_IMPLEMENTED
        )


class ImageDeleteAPIView(APIView):
    """圖片刪除 API"""
    permission_classes = [IsAuthenticated]
    
    def delete(self, request, image_id):
        """
        刪除圖片（包含 Firebase Storage 檔案）
        """
        try:
            image = Image.objects.get(id=image_id)
        except Image.DoesNotExist:
            return APIResponse(
                message="圖片不存在",
                code=drf_status.HTTP_404_NOT_FOUND,
                status=drf_status.HTTP_404_NOT_FOUND
            )
        
        # TODO: 實作 Firebase Storage 檔案刪除邏輯
        # firebase_service.delete_file(image.firebase_path)
        
        image.delete()
        
        return APIResponse(
            message="圖片刪除成功"
        )


class PostImageDeleteAPIView(APIView):
    """刪除貼文中的單張圖片 API"""
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def delete(self, request, post_id, image_id):
        """
        刪除貼文中的指定圖片
        
        Parameters:
        - post_id: 貼文 ID
        - image_id: 圖片 ID
        """
        try:
            # 檢查貼文是否存在且用戶有權限
            try:
                post = PostFrame.objects.get(id=post_id)
            except PostFrame.DoesNotExist:
                return APIResponse(
                    message="貼文不存在",
                    status=drf_status.HTTP_404_NOT_FOUND
                )
            
            # 檢查權限：只有貼文作者可以刪除圖片
            if post.user != request.user:
                return APIResponse(
                    message="您沒有權限刪除此圖片",
                    status=drf_status.HTTP_403_FORBIDDEN
                )
            
            # 檢查圖片是否存在且屬於該貼文
            try:
                image = Image.objects.get(id=image_id, postFrame=post)
            except Image.DoesNotExist:
                return APIResponse(
                    message="圖片不存在或不屬於此貼文",
                    status=drf_status.HTTP_404_NOT_FOUND
                )
            
            # 檢查是否是最後一張圖片 - 允許前端通過 allow_delete_last 參數跳過此檢查
            allow_delete_last = request.query_params.get('allow_delete_last', 'false').lower() == 'true'
            
            if not allow_delete_last:
                remaining_images_count = Image.objects.filter(postFrame=post).count()
                if remaining_images_count <= 1:
                    return APIResponse(
                        message="貼文至少需要保留一張圖片",
                        status=drf_status.HTTP_400_BAD_REQUEST
                    )
            
            # 獲取被刪除圖片的排序位置
            deleted_sort_order = image.sort_order
            
            # 刪除圖片（同時刪除相關的標註）
            from social.models import ImageAnnotation
            ImageAnnotation.objects.filter(firebase_url=image.firebase_url).delete()
            
            # TODO: 實作 Firebase Storage 檔案刪除邏輯
            # firebase_service.delete_file(image.firebase_path)
            
            image.delete()
            
            # 重新調整剩餘圖片的排序順序
            remaining_images = Image.objects.filter(
                postFrame=post,
                sort_order__gt=deleted_sort_order
            ).order_by('sort_order')
            
            for img in remaining_images:
                img.sort_order -= 1
                img.save(update_fields=['sort_order'])
            
            # 清除圖片快取
            ImageService.invalidate_post_image_cache(post_id)
            
            logger.info(f"用戶 {request.user.id} 刪除了貼文 {post_id} 中的圖片 {image_id}")
            
            return APIResponse(
                message="圖片刪除成功",
                data={"deleted_image_id": image_id}
            )
            
        except Exception as e:
            logger.error(f"刪除貼文圖片時出錯: {str(e)}", exc_info=True)
            return APIResponse(
                message=f"刪除圖片失敗: {str(e)}",
                status=drf_status.HTTP_400_BAD_REQUEST
            )


class PostImageReorderAPIView(APIView):
    """重新排序貼文圖片 API"""
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def put(self, request, post_id):
        """
        重新排序貼文中的圖片
        
        Parameters:
        - post_id: 貼文 ID
        
        Request Body:
        {
            "image_orders": [
                {"image_id": 1, "sort_order": 0},
                {"image_id": 2, "sort_order": 1},
                ...
            ]
        }
        """
        try:
            # 檢查貼文是否存在且用戶有權限
            try:
                post = PostFrame.objects.get(id=post_id)
            except PostFrame.DoesNotExist:
                return APIResponse(
                    message="貼文不存在",
                    status=drf_status.HTTP_404_NOT_FOUND
                )
            
            # 檢查權限：只有貼文作者可以重新排序圖片
            if post.user != request.user:
                return APIResponse(
                    message="您沒有權限重新排序此貼文的圖片",
                    status=drf_status.HTTP_403_FORBIDDEN
                )
            
            image_orders = request.data.get('image_orders', [])
            
            if not image_orders:
                return APIResponse(
                    message="請提供圖片排序資料",
                    status=drf_status.HTTP_400_BAD_REQUEST
                )
            
            # 驗證所有圖片都屬於該貼文
            image_ids = [item['image_id'] for item in image_orders]
            existing_images = Image.objects.filter(
                id__in=image_ids,
                postFrame=post
            )
            
            if len(existing_images) != len(image_ids):
                return APIResponse(
                    message="部分圖片不存在或不屬於此貼文",
                    status=drf_status.HTTP_400_BAD_REQUEST
                )
            
            # 更新圖片排序
            for order_data in image_orders:
                image_id = order_data['image_id']
                sort_order = order_data['sort_order']
                
                Image.objects.filter(
                    id=image_id,
                    postFrame=post
                ).update(sort_order=sort_order)
            
            # 清除圖片快取
            ImageService.invalidate_post_image_cache(post_id)
            
            logger.info(f"用戶 {request.user.id} 重新排序了貼文 {post_id} 的圖片")
            
            return APIResponse(
                message="圖片排序更新成功",
                data={"updated_orders": image_orders}
            )
            
        except Exception as e:
            logger.error(f"重新排序貼文圖片時出錯: {str(e)}", exc_info=True)
            return APIResponse(
                message=f"重新排序圖片失敗: {str(e)}",
                status=drf_status.HTTP_400_BAD_REQUEST
            )
