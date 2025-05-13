from django.shortcuts import render, get_object_or_404
from django.contrib.contenttypes.models import ContentType
from django.db.models import F, Count
from rest_framework import generics, status as drf_status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination
from social.models import Post
from .models import Comment
from .serializers import CommentSerializer, CommentReplySerializer
from media.models import Image

class CommentPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

class PostCommentsView(generics.ListCreateAPIView):
    """
    取得單篇貼文下的所有頂層留言，並支援新增留言
    """
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    pagination_class = CommentPagination
    
    def get_queryset(self):
        """
        獲取特定貼文的頂層評論（不包含回覆）
        按照熱門程度(popularity)和時間排序，最新和最熱門的在前
        """
        post_id = self.kwargs.get('post_id')
        get_object_or_404(Post, id=post_id)  # 確認貼文存在，否則返回404
        
        post_type = ContentType.objects.get_for_model(Post)
        
        # 只獲取頂層評論 (parent=None 或 depth=0)
        queryset = Comment.objects.filter(
            content_type=post_type,
            object_id=post_id,
            parent=None
        ).order_by('-popularity', '-post_date')
        
        return queryset
    
    def perform_create(self, serializer):
        """
        建立新評論，關聯到特定貼文
        """
        post_id = self.kwargs.get('post_id')
        post = get_object_or_404(Post, id=post_id)
        post_type = ContentType.objects.get_for_model(Post)
        
        # 建立頂層評論 (depth=0, parent=None)
        serializer.save(
            user=self.request.user,
            content_type=post_type,
            object_id=post_id,
            parent=None,
            depth=0
        )

class CommentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    獲取、更新或刪除特定評論
    """
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    lookup_url_kwarg = 'comment_id'
    
    def update(self, request, *args, **kwargs):
        """
        只允許評論作者編輯
        """
        comment = self.get_object()
        if comment.user != request.user:
            return Response(
                {"detail": "您沒有權限編輯此評論"}, 
                status=drf_status.HTTP_403_FORBIDDEN
            )
        return super().update(request, *args, **kwargs)
    
    def destroy(self, request, *args, **kwargs):
        """
        軟刪除評論：調用模型的 soft_delete 方法
        """
        comment = self.get_object()
        if comment.user != request.user:
            return Response(
                {"detail": "您沒有權限刪除此評論"}, 
                status=drf_status.HTTP_403_FORBIDDEN
            )
        
        comment.soft_delete() # 調用模型方法
        
        return Response(
            {"detail": "評論已成功刪除"}, 
            status=drf_status.HTTP_200_OK
        )

class CommentReplyView(generics.ListCreateAPIView):
    """
    獲取特定評論的所有回覆，並支援新增回覆
    """
    serializer_class = CommentReplySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    pagination_class = CommentPagination
    
    def get_queryset(self):
        """
        獲取特定評論的所有直接回覆，按熱門程度和時間排序
        """
        comment_id = self.kwargs.get('comment_id')
        parent_comment = get_object_or_404(Comment, id=comment_id)
        
        # 獲取所有直接回覆(深度+1)
        queryset = Comment.objects.filter(
            parent=parent_comment
        ).order_by('-popularity', '-post_date')
        
        return queryset
    
    def perform_create(self, serializer):
        """
        建立新回覆，關聯到特定評論
        """
        comment_id = self.kwargs.get('comment_id')
        parent_comment = get_object_or_404(Comment, id=comment_id)
        
        # 建立回覆，繼承父評論的content_type和object_id
        serializer.save(
            user=self.request.user,
            content_type=parent_comment.content_type,
            object_id=parent_comment.object_id,
            parent=parent_comment,
            depth=parent_comment.depth + 1
        )
