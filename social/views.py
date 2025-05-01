from rest_framework import generics
from .models import Post
from .serializers import *
from rest_framework.permissions import IsAuthenticated
from utils.api_response import APIResponse
from utils.query_optimization import log_queries
from django.contrib.contenttypes.models import ContentType
from media.models import Image

#使用者社群首頁post預覽圖
class UserPostsPreviewListAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PostPreviewSerializer

    @log_queries
    def get_queryset(self):
        user_id = self.kwargs['pk']
        # 只需要 select_related user，因為 PostPreviewSerializer 目前不使用 user 數據
        return Post.objects.filter(user_id=user_id).select_related(
            'user'
        ).order_by('-created_at')
    
    # 覆寫 list 方法以使用統一的 APIResponse 格式，並優化圖片查詢
    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        
        # 獲取 post 的內容類型 ID 用於查詢圖片
        post_content_type = ContentType.objects.get_for_model(Post)
        
        # 獲取所有貼文 ID
        post_ids = list(queryset.values_list('id', flat=True))
        
        # 一次性查詢所有相關圖片
        post_images = {}
        if post_ids:
            images = Image.objects.filter(
                content_type=post_content_type,
                object_id__in=post_ids
            ).order_by('object_id', 'sort_order')
            
            # 將圖片按 post_id 分組，每個 post 只取第一張圖片
            for image in images:
                if image.object_id not in post_images:
                    post_images[image.object_id] = image.img_url
        
        # 如果使用分頁，處理分頁
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            
            # 修改序列化器數據，直接使用預加載的圖片
            for item in serializer.data:
                post_id = item['id']
                item['first_image_url'] = post_images.get(post_id)
            
            return self.get_paginated_response(serializer.data)
        
        # 如果不使用分頁
        serializer = self.get_serializer(queryset, many=True)
        
        # 修改序列化器數據，直接使用預加載的圖片
        for item in serializer.data:
            post_id = item['id']
            item['first_image_url'] = post_images.get(post_id)
        
        return APIResponse(
            data=serializer.data,
            message="獲取用戶貼文預覽成功"
        )

