from django.db import models
from django.conf import settings

# === 日常貼文 ===
class Post(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='posts'
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}'s Post at {self.created_at}"

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
