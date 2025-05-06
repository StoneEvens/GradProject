from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

# === 使用者互動記錄 (like/save/upvote/downvote) ===
class UserInteraction(models.Model):
    RELATION_CHOICES = [
        ('liked', 'Liked'),
        ('saved', 'Saved'),
        ('upvoted', 'Upvoted'),
        ('downvoted', 'Downvoted'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='interactions'
    )
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    relation = models.CharField(max_length=20, choices=RELATION_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'content_type', 'object_id', 'relation')

    def __str__(self):
        return f"{self.user.username} {self.relation} {self.content_type} {self.object_id}"

