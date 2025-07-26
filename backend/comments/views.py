from django.shortcuts import get_object_or_404
from django.contrib.contenttypes.models import ContentType
from rest_framework import generics, status as drf_status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination
from social.models import PostFrame
from .models import Comment
from .serializers import CommentSerializer, CommentReplySerializer

class CommentPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

class PostCommentsView(generics.ListCreateAPIView):
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    pagination_class = CommentPagination
    
    def get_queryset(self):
        post_id = self.kwargs.get('post_id')
        postFrame = PostFrame.get_postFrames(postID=post_id)
        comments = Comment.get_comments(postFrame)

        return comments
    
    def perform_create(self, serializer):
        post_id = self.kwargs.get('post_id')
        postFrame = get_object_or_404(PostFrame, id=post_id)
        
        # 建立頂層評論 (depth=0, parent=None)
        serializer.save(
            user=self.request.user,
            postFrame=postFrame,
            content=self.request.data.get('content', ''),
            parent=None
        )

        return Response(
            {"detail": "評論已成功建立"},
            status=drf_status.HTTP_201_CREATED
        )

class CommentDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    
    def update(self, request, *args, **kwargs):
        comment_id = self.kwargs.get('comment_id')
        comment = get_object_or_404(Comment, id=comment_id)

        if comment.user != request.user:
            return Response(
                {"detail": "您沒有權限編輯此評論"}, 
                status=drf_status.HTTP_403_FORBIDDEN
            )
        
        content = request.data.get('content', '')
        comment.update_comment(content=content)

        serializer = CommentSerializer(comment)
        return Response(
            serializer.data, 
            status=drf_status.HTTP_200_OK
        )
    
    def destroy(self, request, *args, **kwargs):
        comment_id = self.kwargs.get('comment_id')
        comment = get_object_or_404(Comment, id=comment_id)

        if comment.user != request.user:
            return Response(
                {"detail": "您沒有權限編輯此評論"}, 
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
        comment_id = self.kwargs.get('comment_id')
        comment = get_object_or_404(Comment, id=comment_id)
        
        # 獲取所有直接回覆(深度+1)
        replies = Comment.get_replies(comment)
        return replies
    
    def perform_create(self, serializer):
        comment_id = self.kwargs.get('comment_id')
        comment = get_object_or_404(Comment, id=comment_id)

        # 建立回覆，繼承父評論的content_type和object_id
        serializer.save(
            user=self.request.user,
            postFrame=comment.postFrame,
            content=self.request.data.get('content', ''),
            parent=comment
        )
