from django.db import models
from django.conf import settings
from accounts.models import CustomUser
from social.models import Interactables

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

    interactables = models.ForeignKey(
        Interactables,
        on_delete=models.CASCADE,
        related_name='post_interaction',
        null=True
    )

    relation = models.CharField(max_length=20, choices=RELATION_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'interactables', 'relation')

    def __str__(self):
        return f"{self.user.username} {self.relation} {self.interactables.id if self.interactables else 'None'} {self.interactables}"

    @staticmethod
    def check_user_interaction(user: CustomUser, interactables: Interactables):
        return UserInteraction.objects.filter(
            user=user,
            interactables=interactables
        )
    
    @staticmethod
    def get_user_interactions(user: CustomUser, relation:str, interactables: Interactables = None):
        if interactables is None:
            return UserInteraction.objects.filter(
                user=user,
                relation=relation
            )

        return UserInteraction.objects.filter(
            user=user,
            interactables=interactables,
            relation=relation
        ).first()
    
    def delete_interaction(self):
        self.delete()

    @staticmethod
    def create_interaction(user, interactables: Interactables, relation):
        try:
            UserInteraction.objects.create(
                user=user,
                interactables=interactables,
                relation=relation
            )
            return True
        except Exception as e:
            print(f"Error creating interaction: {e}")
            return False
