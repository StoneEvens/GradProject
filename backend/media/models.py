from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from gradProject import settings
from pets.models import Pet
from social.models import PostFrame

class Image(models.Model):
    post_frame = models.ForeignKey(PostFrame, on_delete=models.CASCADE, related_name='images')
    content_object = GenericForeignKey('content_type', 'object_id')

    # Firebase Storage 相關欄位
    firebase_url = models.URLField(max_length=500, help_text="Firebase Storage 圖片 URL", blank=True, null=True)
    firebase_path = models.CharField(max_length=255, help_text="Firebase Storage 檔案路徑", blank=True, null=True)
    
    # 圖片基本資訊
    original_filename = models.CharField(max_length=255, blank=True, null=True)
    content_type_mime = models.CharField(max_length=100, blank=True, null=True)
    
    # 排序和描述
    sort_order = models.IntegerField(default=0)
    alt_text = models.CharField(max_length=255, blank=True, help_text="替代文字")
    
    # 時間戳記
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['content_type', 'object_id', 'sort_order']
        indexes = [
            models.Index(fields=['content_type', 'object_id']),
            models.Index(fields=['firebase_path']),
        ]

    def __str__(self):
        return f"Image for {self.content_type} {self.object_id} (sort {self.sort_order})"
    
    @property
    def url(self):
        return self.firebase_url
    
    def get_first_image_url(self, postFrame: PostFrame):
        return self.objects.filter(post_frame=postFrame).order_by('sort_order').first().url


class PetHeadshot(models.Model):
    """寵物頭像模型 - 使用 Firebase Storage"""
    pet = models.OneToOneField(Pet, on_delete=models.CASCADE, related_name='headshot')
    
    # Firebase Storage 相關欄位
    firebase_url = models.URLField(max_length=500, help_text="Firebase Storage 圖片 URL", blank=True, null=True)
    firebase_path = models.CharField(max_length=255, help_text="Firebase Storage 檔案路徑", blank=True, null=True)
    
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Headshot of {self.pet.pet_name}"
    
    @property
    def url(self):
        """獲取圖片的完整 URL"""
        return self.firebase_url


class UserHeadshot(models.Model):
    """用戶頭像模型 - 使用 Firebase Storage"""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='headshot')

    # Firebase Storage 相關欄位
    firebase_url = models.URLField(max_length=500, help_text="Firebase Storage 圖片 URL", blank=True, null=True)
    firebase_path = models.CharField(max_length=255, help_text="Firebase Storage 檔案路徑", blank=True, null=True)
    
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Headshot of {self.user.username}"
    
    def get_headshot_url(self, user):
        return self.objects.filter(user=user).first().firebase_url