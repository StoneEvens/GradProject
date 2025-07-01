from django.db import models
from django.db.models import QuerySet
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from rest_framework import status as drf_status
from django.utils.text import slugify
import re
from typing import TYPE_CHECKING
from pets.models import Pet
from accounts.models import CustomUser

if TYPE_CHECKING:
    from .models import PostFrame

#----------貼文的"框"----------
class PostFrame(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    downvotes = models.IntegerField(default=0, help_text="點踩數")
    saves = models.IntegerField(default=0, help_text="收藏數")
    shares = models.IntegerField(default=0, help_text="分享數")
    upvotes = models.IntegerField(default=0, help_text="點讚數")
    updated_at = models.DateTimeField(auto_now=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='postsframes')

    def __str__(self):
        return f"{self.user.username}'s Post at {self.created_at}"
    
    def create(self, user: CustomUser):
        postFrame = PostFrame.objects.create(user=user)
        return postFrame
    
    def getUser(self):
        return self.user

    # 獲取貼文ID
    def get_postFrame_ID(self):
        return self.id
    
    # 獲取貼文框本身
    def get_postFrame(self, postID):
        try:
            return PostFrame.objects.get(id=postID)
        except PostFrame.DoesNotExist:
            return None
    
    def get_postFrame(self, user):
        return PostFrame.objects.filter(user=user).order_by('-created_at')[:50]

    def handle_interaction(self, fromRelation:str = None, toRelation:str = None):
        update_fields = []
        ops = 0

        if fromRelation is not None:
            if fromRelation == 'upvoted':
                self.upvotes = max(0, self.upvotes - 1)
                update_fields.append('upvotes')
                ops += 1
            elif fromRelation == 'downvoted':
                self.downvotes = max(0, self.downvotes - 1)
                update_fields.append('downvotes')
                ops += 1
            elif fromRelation == 'saved':
                self.saves = max(0, self.saves - 1)
                update_fields.append('saves')
                ops += 1
            elif fromRelation == 'shared':
                self.shares = max(0, self.shares - 1)
                update_fields.append('shares')
                ops += 1
        
        if toRelation is not None:
            if toRelation == 'upvoted':
                self.upvotes = max(0, self.upvotes + 1)
                update_fields.append('upvotes')
                ops += 1
            elif toRelation == 'downvoted':
                self.downvotes = max(0, self.downvotes + 1)
                update_fields.append('downvotes')
                ops += 1
            elif toRelation == 'saved':
                self.saves = max(0, self.saves + 1)
                update_fields.append('saves')
                ops += 1
            elif toRelation == 'shared':
                self.shares = max(0, self.shares + 1)
                update_fields.append('shares')
                ops += 1
        
        if len(update_fields) == ops:
            self.save(update_fields=update_fields)
            return True
        return False

    
    def get_interaction_stats(self):
        
        return {
            self.upvotes,
            self.downvotes,
            self.saves,
            self.shares
        }

#----------貼文內容----------
#SoL (Slice of Life) 貼文內容
class SoLContent(models.Model):
    postFrame = models.ForeignKey(
        PostFrame,
        on_delete=models.CASCADE,
        related_name='contents'
    )
    content_text = models.TextField(help_text="存儲具體內容文本")

    def __str__(self):
        return f"Content for Post {self.post.id} - Type: {self.content_type}"
    
    def create(self, postFrame: PostFrame, content_text: str):
        content = SoLContent.objects.create(
            postFrame=postFrame,
            content_text=content_text
        )
        return content
    
    def get_content(self, PostFrame: PostFrame):
        return SoLContent.objects.filter(
            postFrame=PostFrame
        )

    def get_content(self, user: CustomUser):
        return SoLContent.objects.filter(
            postFrame__user=user
        )[:50]
    
    def get_content(self, hashtag: str):
        return SoLContent.objects.filter(
            postFrame__hashtags__tag=hashtag
        )[:50]
    
    def get_content(self, query: str):
        return SoLContent.objects.filter(
            content_text__icontains=query
        )[:50]

# === 貼文的 Hashtag ===
class PostHashtag(models.Model):
    postFrame = models.ForeignKey(
        PostFrame,
        on_delete=models.CASCADE,
        related_name='hashtags'
    )
    tag = models.CharField(max_length=50)

    def __str__(self):
        return f"#{self.tag} for Post {self.post.id}"
    
    def create(self, postFrame: PostFrame, tag: str):
        tag = slugify(tag)
        hashtag = PostHashtag.objects.create(
            postFrame=postFrame,
            tag=tag
        )
        return hashtag

    def get_hashtags(PostFrame: PostFrame) -> QuerySet:
        return PostHashtag.objects.filter(
            postFrame=PostFrame
        )

    def get_hashtags(query:str) -> QuerySet:
        return PostHashtag.objects.filter(
            tag__icontains=query
        )[:50]
    
    def get_hashtags(query:str, count: int) -> QuerySet:
        return PostHashtag.objects.filter(
            tag__icontains=query
        )[:count]

class PostPets(models.Model):
    postFrame = models.ForeignKey(
        PostFrame,
        on_delete=models.CASCADE,
        related_name='tagged_pets'
    )
    pet = models.ForeignKey(
        Pet,
        on_delete=models.CASCADE,
        related_name='tagged_posts'
    )

    def __str__(self):
        return f"{self.pet.pet_name} tagged in Post {self.postFrame.id}"
    
    def create(self, postFrame: PostFrame, pet: Pet):
        tagged_pet = PostPets.objects.create(
            postFrame=postFrame,
            pet=pet
        )
        return tagged_pet