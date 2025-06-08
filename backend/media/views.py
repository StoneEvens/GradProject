"""
媒體檔案相關的 API Views - Firebase Storage 版本
"""

import logging
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import status as drf_status
from django.shortcuts import get_object_or_404

from utils.api_response import APIResponse
from .models import Image, UserHeadshot, PetHeadshot
from .serializers import ImageSerializer, UserHeadshotSerializer, PetHeadshotSerializer
from pets.models import Pet

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
