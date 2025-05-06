from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from gradProject import settings
from pets.models import Pet

class Image(models.Model):
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')

    # TODO: [雲端存儲] 當實現雲端儲存時，這個字段將存儲完整的雲端 URL
    # 目前是使用 Django 的 FileField/ImageField 上傳到本地，未來可能需要轉換為純文本 URL
    img_url = models.TextField()  # 圖片網址
    
    # TODO: [雲端存儲] 可能需要添加以下字段以支持雲端存儲
    # storage_provider = models.CharField(max_length=20, blank=True, null=True)  # 存儲提供商 (S3, Azure, etc.)
    # original_filename = models.CharField(max_length=255, blank=True, null=True)  # 原始文件名
    # file_size = models.PositiveIntegerField(blank=True, null=True)  # 文件大小 (bytes)
    # content_type = models.CharField(max_length=100, blank=True, null=True)  # 文件 MIME 類型
    
    sort_order = models.IntegerField(default=0)
    alt_text = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['content_type', 'object_id', 'sort_order']
        indexes = [
            models.Index(fields=['content_type', 'object_id']),
        ]

    def __str__(self):
        return f"Image for {self.content_type} {self.object_id} (sort {self.sort_order})"
    
    @property
    def url(self):
        """
        獲取圖片的完整 URL
        
        TODO: [雲端存儲] 雲端實現後，這個方法需要根據存儲方式返回正確的 URL
        目前假設 img_url 是完整 URL 或者是相對於 MEDIA_URL 的路徑
        """
        if hasattr(self.img_url, 'url'):
            # 如果 img_url 是 FileField/ImageField，使用其 url 屬性
            return self.img_url.url
        elif self.img_url and '://' in self.img_url:
            # 如果已經是完整 URL（包含協議），直接返回
            return self.img_url
        else:
            # 否則假設是相對路徑，添加 MEDIA_URL
            # TODO: 這是臨時解決方案，未來應有更好的處理方式
            from django.conf import settings
            media_url = getattr(settings, 'MEDIA_URL', '/media/')
            return f"{media_url.rstrip('/')}/{self.img_url.lstrip('/')}"

class PetHeadshot(models.Model):
    pet = models.OneToOneField(Pet, on_delete=models.CASCADE, related_name='headshot')
    
    # TODO: [雲端存儲] 同上，當實現雲端儲存時，這個字段將存儲完整的雲端 URL
    img_url = models.TextField()  
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Headshot of {self.pet.pet_name}"
    
    @property
    def url(self):
        """
        獲取圖片的完整 URL
        
        TODO: [雲端存儲] 雲端實現後，這個方法需要根據存儲方式返回正確的 URL
        """
        if hasattr(self.img_url, 'url'):
            return self.img_url.url
        elif self.img_url and '://' in self.img_url:
            return self.img_url
        else:
            from django.conf import settings
            media_url = getattr(settings, 'MEDIA_URL', '/media/')
            return f"{media_url.rstrip('/')}/{self.img_url.lstrip('/')}"

class UserHeadshot(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='headshot')
    
    # TODO: [雲端存儲] 同上，當實現雲端儲存時，這個字段將存儲完整的雲端 URL
    img_url = models.TextField()  
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Headshot of {self.user.username}"
    
    @property
    def url(self):
        """
        獲取圖片的完整 URL
        
        TODO: [雲端存儲] 雲端實現後，這個方法需要根據存儲方式返回正確的 URL
        """
        if hasattr(self.img_url, 'url'):
            return self.img_url.url
        elif self.img_url and '://' in self.img_url:
            return self.img_url
        else:
            from django.conf import settings
            media_url = getattr(settings, 'MEDIA_URL', '/media/')
            return f"{media_url.rstrip('/')}/{self.img_url.lstrip('/')}"