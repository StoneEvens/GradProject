from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from gradProject import settings
from pets.models import Pet

class Image(models.Model):
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')

    # 儲存圖片 URL（暫時保留結構，之後會使用新的雲端儲存）
    img_url = models.URLField(max_length=500, blank=True, null=True)
    
    # 圖片相關欄位（保留結構，之後會用於新的雲端儲存）
    public_id = models.CharField(max_length=255, blank=True, null=True)
    original_filename = models.CharField(max_length=255, blank=True, null=True)
    file_size = models.PositiveIntegerField(blank=True, null=True)
    content_type_mime = models.CharField(max_length=100, blank=True, null=True)
    
    sort_order = models.IntegerField(default=0)
    alt_text = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['content_type', 'object_id', 'sort_order']
        indexes = [
            models.Index(fields=['content_type', 'object_id']),
            models.Index(fields=['public_id']),
        ]

    def __str__(self):
        return f"Image for {self.content_type} {self.object_id} (sort {self.sort_order})"
    
    @property
    def url(self):
        """
        獲取圖片的完整 URL
        """
        return self.img_url or ""


class PetHeadshot(models.Model):
    pet = models.OneToOneField(Pet, on_delete=models.CASCADE, related_name='headshot')
    
    # 儲存圖片 URL（暫時保留結構，之後會使用新的雲端儲存）
    img_url = models.URLField(max_length=500, blank=True, null=True)
    public_id = models.CharField(max_length=255, blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Headshot of {self.pet.pet_name}"
    
    @property
    def url(self):
        """
        獲取圖片的完整 URL
        """
        return self.img_url or ""


class UserHeadshot(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='headshot')
    
    # 儲存圖片 URL（暫時保留結構，之後會使用新的雲端儲存）
    img_url = models.URLField(max_length=500, blank=True, null=True)
    public_id = models.CharField(max_length=255, blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Headshot of {self.user.username}"
    
    @property
    def url(self):
        """
        獲取圖片的完整 URL
        """
        return self.img_url or ""