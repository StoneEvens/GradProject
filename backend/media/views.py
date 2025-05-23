"""
媒體檔案相關的 API Views
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


class ImageUploadAPIView(APIView):
    """通用圖片上傳 API（暫時停用）"""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    def post(self, request):
        """
        上傳圖片到指定的模型對象（暫時停用）
        
        POST 數據:
        - image: 圖片檔案 (必填)
        - content_type_id: ContentType ID (必填)
        - object_id: 對象 ID (必填)
        - alt_text: 替代文字 (選填)
        - sort_order: 排序 (選填, 預設 0)
        """
        return APIResponse(
            message="圖片上傳功能暫時停用，正在設定新的雲端儲存服務",
            code=drf_status.HTTP_503_SERVICE_UNAVAILABLE,
            status=drf_status.HTTP_503_SERVICE_UNAVAILABLE
        )


class UserAvatarUploadAPIView(APIView):
    """用戶頭像上傳 API（暫時停用）"""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    def post(self, request):
        """
        上傳用戶頭像（暫時停用）
        
        POST 數據:
        - avatar: 頭像圖片檔案 (必填)
        """
        return APIResponse(
            message="頭像上傳功能暫時停用，正在設定新的雲端儲存服務",
            code=drf_status.HTTP_503_SERVICE_UNAVAILABLE,
            status=drf_status.HTTP_503_SERVICE_UNAVAILABLE
        )


class PetPhotoUploadAPIView(APIView):
    """寵物照片上傳 API（暫時停用）"""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    def post(self, request, pet_id):
        """
        上傳寵物頭像（暫時停用）
        
        POST 數據:
        - photo: 寵物照片檔案 (必填)
        - photo_type: 照片類型 (headshot/general, 預設 headshot)
        """
        return APIResponse(
            message="寵物照片上傳功能暫時停用，正在設定新的雲端儲存服務",
            code=drf_status.HTTP_503_SERVICE_UNAVAILABLE,
            status=drf_status.HTTP_503_SERVICE_UNAVAILABLE
        )


class ImageDeleteAPIView(APIView):
    """圖片刪除 API（暫時停用）"""
    permission_classes = [IsAuthenticated]
    
    def delete(self, request, image_id):
        """
        刪除圖片（暫時停用）
        """
        return APIResponse(
            message="圖片刪除功能暫時停用，正在設定新的雲端儲存服務",
            code=drf_status.HTTP_503_SERVICE_UNAVAILABLE,
            status=drf_status.HTTP_503_SERVICE_UNAVAILABLE
        )
