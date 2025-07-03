from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from accounts.models import CustomUser
from social.models import PostFrame

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
        related_name='user_interaction'
    )

    postFrame = models.ForeignKey(
        PostFrame,
        on_delete=models.CASCADE,
        related_name='post_interaction',
        null=True
    )

    relation = models.CharField(max_length=20, choices=RELATION_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'relation')

    def __str__(self):
        return f"{self.user.username} {self.relation} {self.content_type} {self.object_id}"
    
    def check_user_interaction(user: CustomUser, postFrame: PostFrame):
        return UserInteraction.objects.filter(
            user=user,
            postFrame = postFrame
        )
    
    def get_user_interaction(user: CustomUser, postFrame: PostFrame, relation:str):
        return UserInteraction.objects.filter(
            user=user,
            postFrame = postFrame,
            relation=relation
        ).first()
    
    def delete_interaction(self, interaction):
        interaction.delete()

    def create_interaction(user, postID, relation):
        try:
            UserInteraction.object.create(
                user=user,
                content_type=PostFrame,
                object_id=postID,
                relation=relation
            )
            return True
        except Exception as e:
            return False
