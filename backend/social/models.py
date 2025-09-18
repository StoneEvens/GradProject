from django.db import models
from django.db.models import QuerySet
from django.db.models import Case, When, IntegerField
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from rest_framework import status as drf_status
from django.utils.text import slugify
import re
from pets.models import Pet
from accounts.models import CustomUser

class Interactables(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    downvotes = models.IntegerField(default=0, help_text="點踩數")
    likes = models.IntegerField(default=0, help_text="按讚數")
    saves = models.IntegerField(default=0, help_text="收藏數")
    shares = models.IntegerField(default=0, help_text="分享數")
    upvotes = models.IntegerField(default=0, help_text="點讚數")

    def handle_interaction(self, fromRelation:str = None, toRelation:str = None):

        update_fields = []
        ops = 0

        if fromRelation is not None:
            if fromRelation == 'liked':
                self.likes = max(0, self.likes - 1)
                update_fields.append('likes')
                ops += 1
            elif fromRelation == 'upvoted':
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
            if toRelation == 'liked':
                self.likes = max(0, self.likes + 1)
                update_fields.append('likes')
                ops += 1
            elif toRelation == 'upvoted':
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
        
        return [
            self.upvotes,
            self.downvotes,
            self.saves,
            self.shares,
            self.likes
        ]
    
    def _get_action_name(self, relation):
        """獲取互動類型的中文名稱"""
        action_names = {
            'liked': '按讚',
            'upvoted': '點讚',
            'downvoted': '踩',
            'saved': '收藏',
            'shared': '分享'
        }
        return action_names.get(relation, relation)

#----------貼文的"框"----------
class PostFrame(Interactables):
    updated_at = models.DateTimeField(auto_now=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='postframes')
    comments_count = models.IntegerField(default=0, help_text="評論數")

    def __str__(self):
        return f"{self.id} {self.user.username}'s Post at {self.created_at}"
    
    def create(user: CustomUser):
        postFrame = PostFrame.objects.create(user=user)
        return postFrame
    
    def getUser(self):
        return self.user

    # 獲取貼文ID
    def get_postFrame_ID(self):
        return self.id
    
    # 獲取貼文框本身
    def get_postFrames(postID=None, user=None, userList:list=None, idList:list=None):
        if postID is not None:
            try:
                return PostFrame.objects.get(id=postID)
            except PostFrame.DoesNotExist:
                return None
            
        if user is not None:
            return PostFrame.objects.filter(user=user).order_by('-created_at')[:50]
        
        if userList is not None:
            return PostFrame.objects.filter(user__in=userList).order_by('-created_at')[:50]
        
        if idList is not None:
            # 保持返回順序與提供的 idList 相同
            preserved = Case(
                *[When(id=pk, then=pos) for pos, pk in enumerate(idList)],
                output_field=IntegerField(),
            )
            return PostFrame.objects.filter(id__in=idList).order_by(preserved)
        
        return PostFrame.objects.none()

    def get_interaction_stats(self):
        # 留言數由序列化器動態計算，這裡只返回基本的互動統計
        return super().get_interaction_stats()

#----------貼文內容----------
#SoL (Slice of Life) 貼文內容
class SoLContent(models.Model):
    postFrame = models.ForeignKey(
        PostFrame,
        on_delete=models.CASCADE,
        related_name='contents'
    )
    content_text = models.TextField(help_text="存儲具體內容文本")
    location = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="貼文地點位置"
    )

    def __str__(self):
        return f"Content for Post {self.postFrame.id}"
    
    def create(postFrame: PostFrame, content_text: str, location: str = None):
        content = SoLContent.objects.create(
            postFrame=postFrame,
            content_text=content_text,
            location=location
        )
        return content
    
    def get_content(postFrame:PostFrame=None, postFrameList:list = None, user=None, hashtag:str=None, query:str=None):

        if postFrame is not None:
            return SoLContent.objects.filter(postFrame=postFrame)
        
        if postFrameList is not None:
            return SoLContent.objects.filter(postFrame__in=postFrameList)
        
        if user is not None:
            return SoLContent.objects.filter(postFrame__user=user).order_by('-postFrame__created_at')[:50]
        
        if hashtag is not None:
            return SoLContent.objects.filter(postFrame__hashtags__tag=hashtag)[:50]
        
        if query is not None:
            return SoLContent.objects.filter(content_text__icontains=query)[:50]
        
        return SoLContent.objects.none()
    
    def get_postFrame(self) -> PostFrame:
        return self.postFrame

# === 貼文的 Hashtag ===
class PostHashtag(models.Model):
    postFrame = models.ForeignKey(
        PostFrame,
        on_delete=models.CASCADE,
        related_name='hashtags'
    )
    tag = models.CharField(max_length=50)

    def __str__(self):
        return f"#{self.tag} for Post {self.postFrame.id}"
    
    def create(postFrame: PostFrame, tag: str):
        # 直接使用原始標籤，不進行 slugify 轉換以保留中文字符
        hashtag = PostHashtag.objects.create(
            postFrame=postFrame,
            tag=tag.strip()  # 只移除前後空白
        )
        return hashtag

    def get_hashtags(postFrame: PostFrame = None, query: str = None, count: int = None) -> QuerySet:

        if postFrame is not None:
            return PostHashtag.objects.filter(postFrame=postFrame)
        
        if query is not None and count is not None:
            return PostHashtag.objects.filter(tag__icontains=query)[:count]
        
        if query is not None:
            return PostHashtag.objects.filter(tag__icontains=query)[:50]
        
        return PostHashtag.objects.none()
    
    def get_postFrame(taglist: list):

        return PostFrame.objects.filter(id__in=taglist)

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
    
    def create(postFrame: PostFrame, pet: Pet):
        tagged_pet = PostPets.objects.create(
            postFrame=postFrame,
            pet=pet
        )
        return tagged_pet
    
    def get_pets(postFrame:PostFrame):
        return PostPets.objects.filter(postFrame=postFrame)

#----------圖片標註----------
class ImageAnnotation(models.Model):
    """
    圖片標註模型 - 用於在圖片上標記用戶或寵物的位置
    """
    # 圖片關聯 - 使用 firebase_url 作為外鍵
    firebase_url = models.URLField(
        max_length=500, 
        help_text="關聯的圖片 Firebase URL"
    )
    
    # 標註位置座標（百分比）
    x_position = models.FloatField(
        help_text="標註點在圖片上的 X 座標（百分比 0-100）"
    )
    y_position = models.FloatField(
        help_text="標註點在圖片上的 Y 座標（百分比 0-100）"
    )
    
    
    # 標註目標類型和ID
    TARGET_CHOICES = [
        ('user', '用戶'),
        ('pet', '寵物'),
    ]
    target_type = models.CharField(
        max_length=10,
        choices=TARGET_CHOICES,
        help_text="標註目標類型"
    )
    target_id = models.PositiveIntegerField(
        help_text="標註目標的 ID（用戶 ID 或寵物 ID）"
    )
    
    # 創建者
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_annotations',
        help_text="創建此標註的用戶"
    )
    
    # 時間戳
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['firebase_url']),
            models.Index(fields=['target_type', 'target_id']),
        ]

    def __str__(self):
        return f"標註: {self.dynamic_name} 在 {self.firebase_url[:50]}..."

    @staticmethod
    def create(firebase_url: str, x_position: float, y_position: float, 
               target_type: str, target_id: int, created_by):
        """
        創建新的圖片標註
        
        Parameters:
        - firebase_url: 圖片的 Firebase URL
        - x_position: X 座標（百分比）
        - y_position: Y 座標（百分比）
        - target_type: 目標類型（'user' 或 'pet'）
        - target_id: 目標 ID
        - created_by: 創建者用戶物件
        
        Returns:
        - ImageAnnotation: 創建的標註物件
        """
        annotation = ImageAnnotation.objects.create(
            firebase_url=firebase_url,
            x_position=x_position,
            y_position=y_position,
            target_type=target_type,
            target_id=target_id,
            created_by=created_by
        )
        
        return annotation

    @staticmethod
    def get_annotations_by_image(firebase_url: str):
        """
        根據圖片 URL 獲取所有標註
        
        Parameters:
        - firebase_url: 圖片的 Firebase URL
        
        Returns:
        - QuerySet: 該圖片的所有標註
        """
        return ImageAnnotation.objects.filter(firebase_url=firebase_url).order_by('created_at')

    @staticmethod
    def get_annotations_by_user(user):
        """
        獲取指定用戶創建的所有標註
        
        Parameters:
        - user: 用戶物件
        
        Returns:
        - QuerySet: 用戶創建的所有標註
        """
        return ImageAnnotation.objects.filter(created_by=user).order_by('-created_at')

    @staticmethod
    def get_annotations_by_target(target_type: str, target_id: int):
        """
        獲取標註特定目標的所有標註
        
        Parameters:
        - target_type: 目標類型（'user' 或 'pet'）
        - target_id: 目標 ID
        
        Returns:
        - QuerySet: 標註該目標的所有標註
        """
        return ImageAnnotation.objects.filter(
            target_type=target_type,
            target_id=target_id
        ).order_by('-created_at')

    def get_target_object(self):
        """
        獲取標註的目標物件
        
        Returns:
        - object: 根據 target_type 返回對應的用戶或寵物物件
        """
        if self.target_type == 'user':
            from accounts.models import CustomUser
            try:
                return CustomUser.objects.get(id=self.target_id)
            except CustomUser.DoesNotExist:
                return None
        elif self.target_type == 'pet':
            try:
                return Pet.objects.get(id=self.target_id)
            except Pet.DoesNotExist:
                return None
        return None

    @property
    def dynamic_name(self):
        """
        動態獲取標註目標的名稱
        
        Returns:
        - str: 根據 target_type 和 target_id 動態獲取的名稱
        """
        target_object = self.get_target_object()
        if target_object is None:
            return f"{self.target_type}_{self.target_id}"  # 回退到類型_ID
        
        if self.target_type == 'user':
            # 優先使用 username，如果沒有則使用 user_fullname
            return target_object.username or target_object.user_fullname or f"用戶_{self.target_id}"
        elif self.target_type == 'pet':
            # 使用寵物名稱
            return target_object.pet_name or f"寵物_{self.target_id}"
        
        return f"{self.target_type}_{self.target_id}"

    def update_annotation(self, x_position=None, y_position=None):
        """
        更新標註資訊
        
        Parameters:
        - x_position: 新的 X 座標（可選）
        - y_position: 新的 Y 座標（可選）
        
        Returns:
        - bool: 更新是否成功
        """
        update_fields = []
        
        if x_position is not None:
            self.x_position = x_position
            update_fields.append('x_position')
        
        if y_position is not None:
            self.y_position = y_position
            update_fields.append('y_position')
        
        if update_fields:
            update_fields.append('updated_at')
            self.save(update_fields=update_fields)
            return True
        
        return False