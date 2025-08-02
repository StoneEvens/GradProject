from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from social.models import PostFrame, Interactables

class Comment(Interactables):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='comments'
    )

    postFrame = models.ForeignKey(
        PostFrame,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='comments'
    )

    content = models.TextField(blank=True, default='')
    popularity = models.IntegerField(default=0)

    parent = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='replies'
    )

    def __str__(self):
        return f"Comment {self.id if self.id else ''} by {self.user.username}"
    
    def get_comments(postFrame: PostFrame):
        return Comment.objects.filter(postFrame=postFrame, parent=None).order_by('-popularity', '-created_at')

    def get_replies(parent):
        return Comment.objects.filter(parent=parent).order_by('-popularity', '-created_at')

    def update_comment(self, content):
        self.content = content
        self.save()
        return self

    def soft_delete(self):
        """軟刪除評論：清空內容，重置熱度，並刪除關聯圖片。"""
        import logging
        logger = logging.getLogger(__name__)
        
        self.content = "[此評論已刪除]"
        self.popularity = 0
        self.save(update_fields=['content', 'popularity'])

        # 刪除關聯的圖片（包含 Firebase Storage 中的檔案）
        from media.models import CommentImage
        from utils.firebase_service import firebase_storage_service
        
        comment_content_type = ContentType.objects.get_for_model(Comment)
        comment_images = CommentImage.objects.filter(
            content_type=comment_content_type,
            object_id=self.id
        )
        
        # 收集所有需要從 Firebase 刪除的路徑
        firebase_paths = [img.firebase_path for img in comment_images if img.firebase_path]
        
        # 從 Firebase Storage 批量刪除圖片
        if firebase_paths:
            try:
                success, message, results = firebase_storage_service.delete_comment_images_batch(firebase_paths)
                if success:
                    logger.info(f"留言 {self.id} 的所有圖片已從 Firebase Storage 刪除")
                else:
                    logger.warning(f"留言 {self.id} 的部分圖片從 Firebase Storage 刪除失敗: {message}")
            except Exception as e:
                logger.error(f"刪除留言 {self.id} 的 Firebase 圖片時發生錯誤: {str(e)}")
        
        # 從資料庫刪除圖片記錄
        comment_images.delete()
        logger.info(f"留言 {self.id} 的圖片記錄已從資料庫刪除")
    
    def delete(self, *args, **kwargs):
        """覆寫刪除方法，確保級聯刪除時也刪除 Firebase 圖片"""
        import logging
        logger = logging.getLogger(__name__)
        
        # 刪除關聯的圖片（包含 Firebase Storage 中的檔案）
        from media.models import CommentImage
        from utils.firebase_service import firebase_storage_service
        
        comment_content_type = ContentType.objects.get_for_model(Comment)
        comment_images = CommentImage.objects.filter(
            content_type=comment_content_type,
            object_id=self.id
        )
        
        # 收集所有需要從 Firebase 刪除的路徑
        firebase_paths = [img.firebase_path for img in comment_images if img.firebase_path]
        
        # 從 Firebase Storage 批量刪除圖片
        if firebase_paths:
            try:
                success, message, results = firebase_storage_service.delete_comment_images_batch(firebase_paths)
                if success:
                    logger.info(f"留言 {self.id} 的所有圖片已從 Firebase Storage 刪除")
                else:
                    logger.warning(f"留言 {self.id} 的部分圖片從 Firebase Storage 刪除失敗: {message}")
            except Exception as e:
                logger.error(f"刪除留言 {self.id} 的 Firebase 圖片時發生錯誤: {str(e)}")
        
        # 調用父類的刪除方法
        super().delete(*args, **kwargs)
