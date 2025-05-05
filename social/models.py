from django.db import models
from django.conf import settings
from django.contrib.contenttypes.models import ContentType

# === 日常貼文 ===
class Post(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='posts'
    )
    content = models.TextField()
    popularity = models.IntegerField(default=0, help_text="熱度，主要由點讚數決定")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}'s Post at {self.created_at}"
    
    def get_interaction_stats(self):
        """
        獲取貼文互動統計
        """
        from interactions.models import UserInteraction
        
        post_type = ContentType.objects.get_for_model(Post)
        
        upvotes = UserInteraction.objects.filter(
            content_type=post_type,
            object_id=self.id,
            relation='upvoted'
        ).count()
        
        downvotes = UserInteraction.objects.filter(
            content_type=post_type,
            object_id=self.id,
            relation='downvoted'
        ).count()
        
        saves = UserInteraction.objects.filter(
            content_type=post_type,
            object_id=self.id,
            relation='saved'
        ).count()
        
        shares = UserInteraction.objects.filter(
            content_type=post_type,
            object_id=self.id,
            relation='shared'
        ).count()
        
        return {
            'upvotes': upvotes,
            'downvotes': downvotes,
            'saves': saves,
            'shares': shares,
            'total_score': upvotes - downvotes
        }
    
    def check_user_interaction(self, user, relation):
        """
        檢查用戶是否對貼文有特定互動
        """
        if not user or not user.is_authenticated:
            return False
            
        from interactions.models import UserInteraction
        
        post_type = ContentType.objects.get_for_model(Post)
        return UserInteraction.objects.filter(
            user=user,
            content_type=post_type,
            object_id=self.id,
            relation=relation
        ).exists()

# === 貼文的 Hashtag ===
class PostHashtag(models.Model):
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name='hashtags'
    )
    tag = models.CharField(max_length=50)

    def __str__(self):
        return f"#{self.tag} for Post {self.post.id}"
