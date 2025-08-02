from django.shortcuts import get_object_or_404
from django.contrib.contenttypes.models import ContentType
from rest_framework import generics, status as drf_status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination
from social.models import PostFrame
from .models import Comment
from .serializers import CommentSerializer, CommentReplySerializer
from utils.firebase_service import firebase_storage_service
from media.models import CommentImage
import logging

logger = logging.getLogger(__name__)

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
        
        # 取得內容和圖片
        content = self.request.data.get('content', '').strip()
        images = self.request.FILES.getlist('images')
        
        # 檢查是否至少有內容或圖片
        if not content and not images:
            return Response(
                {"detail": "留言內容或圖片至少需要提供一項"},
                status=drf_status.HTTP_400_BAD_REQUEST
            )
        
        # 建立頂層評論 (depth=0, parent=None)
        comment = serializer.save(
            user=self.request.user,
            postFrame=postFrame,
            content=content,
            parent=None
        )

        # 處理圖片上傳
        if images:
            try:
                # 使用批量上傳方法
                success, message, uploaded_images = firebase_storage_service.upload_comment_images_batch(
                    user_id=self.request.user.id,
                    comment_id=comment.id,
                    image_files=images
                )
                
                if success:
                    # 為每張成功上傳的圖片創建 CommentImage 記錄
                    for image_info in uploaded_images:
                        CommentImage.objects.create(
                            content_object=comment,
                            firebase_url=image_info['firebase_url'],
                            firebase_path=image_info['firebase_path'],
                            sort_order=image_info['sort_order'],
                            original_filename=image_info['original_filename'],
                            file_size=image_info['file_size'],
                            content_type_mime=image_info['content_type']
                        )
                    logger.info(f"留言 {comment.id} 的 {len(uploaded_images)} 張圖片上傳成功")
                else:
                    logger.warning(f"留言 {comment.id} 圖片上傳部分失敗: {message}")
                    
            except Exception as e:
                logger.error(f"留言 {comment.id} 圖片處理失敗: {str(e)}")

        # 留言數現在由序列化器動態計算，不需要手動維護
        
        # 返回創建的留言數據
        serializer_data = CommentSerializer(comment, context={'request': self.request}).data
        return Response(serializer_data, status=drf_status.HTTP_201_CREATED)

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
        parent_comment = get_object_or_404(Comment, id=comment_id)

        # 取得內容和圖片
        content = self.request.data.get('content', '').strip()
        images = self.request.FILES.getlist('images')
        
        # 檢查是否至少有內容或圖片
        if not content and not images:
            return Response(
                {"detail": "回覆內容或圖片至少需要提供一項"},
                status=drf_status.HTTP_400_BAD_REQUEST
            )

        # 建立回覆，繼承父評論的content_type和object_id
        reply_comment = serializer.save(
            user=self.request.user,
            postFrame=parent_comment.postFrame,
            content=content,
            parent=parent_comment
        )

        # 處理圖片上傳
        if images:
            try:
                # 使用批量上傳方法
                success, message, uploaded_images = firebase_storage_service.upload_comment_images_batch(
                    user_id=self.request.user.id,
                    comment_id=reply_comment.id,
                    image_files=images
                )
                
                if success:
                    # 為每張成功上傳的圖片創建 CommentImage 記錄
                    for image_info in uploaded_images:
                        CommentImage.objects.create(
                            content_object=reply_comment,
                            firebase_url=image_info['firebase_url'],
                            firebase_path=image_info['firebase_path'],
                            sort_order=image_info['sort_order'],
                            original_filename=image_info['original_filename'],
                            file_size=image_info['file_size'],
                            content_type_mime=image_info['content_type']
                        )
                    logger.info(f"回覆 {reply_comment.id} 的 {len(uploaded_images)} 張圖片上傳成功")
                else:
                    logger.warning(f"回覆 {reply_comment.id} 圖片上傳部分失敗: {message}")
                    
            except Exception as e:
                logger.error(f"回覆 {reply_comment.id} 圖片處理失敗: {str(e)}")
        
        # 留言數現在由序列化器動態計算，不需要手動維護
        
        # 返回創建的回覆數據
        serializer_data = CommentReplySerializer(reply_comment, context={'request': self.request}).data
        return Response(serializer_data, status=drf_status.HTTP_201_CREATED)
