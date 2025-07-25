from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from media.models import Image
from social.models import PostFrame

class Comment(models.Model):
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

    post_date = models.DateTimeField(auto_now_add=True)
    content = models.TextField()
    popularity = models.IntegerField(default=0)

    parent = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='replies'
    )

    def __str__(self):
        return f"Comment by {self.user.username} on {self.parent}"
    
    def get_comments(postFrame: PostFrame):
        return Comment.objects.filter(postFrame=postFrame, parent=None).order_by('-popularity', '-post_date')
    
    def get_replies(parent_comment_id):
        return Comment.objects.filter(parent_id=parent_comment_id).order_by('-popularity', '-post_date')
    
    def update_comment(self, content):
        self.content = content
        self.save()
        return self

    def soft_delete(self):
        """軟刪除評論：清空內容，重置熱度，並刪除關聯圖片。"""
        self.content = "[此評論已刪除]"
        self.popularity = 0
        self.save(update_fields=['content', 'popularity'])

        # 刪除關聯的圖片
        # 假設 Image 模型中 content_object 指向 Comment
        comment_content_type = ContentType.objects.get_for_model(Comment)
        Image.objects.filter(
            content_type=comment_content_type,
            object_id=self.id
        ).delete()
        # 可以考慮返回 True 或 False，或讓異常自然拋出
