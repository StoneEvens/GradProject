from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from gradProject import settings
from pets.models import Pet
from social.models import PostFrame
from accounts.models import CustomUser

from utils.firebase_service import cleanup_old_headshot

class SuperImage(models.Model):
    #Storage Details
    firebase_url = models.URLField(max_length=500, help_text="Firebase Storage 圖片 URL", blank=True, null=True)
    firebase_path = models.CharField(max_length=255, help_text="Firebase Storage 檔案路徑", blank=True, null=True)
    
    #Image Details
    original_filename = models.CharField(max_length=255, blank=True, null=True)
    file_size = models.PositiveIntegerField(blank=True, null=True, help_text='File Size')
    content_type_mime = models.CharField(max_length=100, blank=True, null=True)
    
    #Sort & Text Replacements
    alt_text = models.CharField(max_length=255, blank=True, help_text="替代文字")
    
    #Time Stamps
    uploaded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

    @property
    def url(self):
        return self.firebase_url
    
    def create(self, firebase_path:str, firebase_url:str):
        self.firebase_path = firebase_path
        self.firebase_url = firebase_url

        self.save(firebase_path, firebase_url)

    def delete(self):
        image_url = self.firebase_path

        try:
            cleanup_old_headshot(image_url)
        except TypeError:
            return
        
        self.delete()

class Image(SuperImage):
    postFrame = models.ForeignKey(PostFrame, on_delete=models.CASCADE, related_name='images', null=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ['id', 'sort_order']
        indexes = [
            models.Index(fields=['id']),
            models.Index(fields=['firebase_path'])
        ]
    
    def create(self, postFrame: PostFrame, firebase_path:str, firebase_url:str):
        super().create(firebase_path=firebase_path, firebase_url=firebase_url)
        Image.objects.create(postFrame=postFrame)
    
    def get_first_image_url(self, postFrame: PostFrame):
        return self.objects.filter(post_frame=postFrame).order_by('sort_order').first().url()


class PetHeadshot(SuperImage):
    pet = models.OneToOneField(Pet, on_delete=models.CASCADE, related_name='headshot')
    
    @staticmethod
    def get_pet_headshot_url(pet):
        """獲取寵物頭像 URL"""
        try:
            headshot = PetHeadshot.objects.filter(pet=pet).first()
            return headshot.firebase_url if headshot else None
        except:
            return None


class UserHeadshot(SuperImage):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='headshot')
    
    @staticmethod
    def get_headshot_url(user):
        """獲取用戶頭像 URL"""
        try:
            headshot = UserHeadshot.objects.filter(user=user).first()
            return headshot.firebase_url if headshot else ""
        except:
            return ""
        
    @staticmethod
    def get_headshot(user):
        """獲取用戶頭像對象"""
        return UserHeadshot.objects.filter(user=user).first()
        
    @staticmethod
    def create(user, firebase_path: str, firebase_url: str):
        """創建用戶頭像記錄"""
        return UserHeadshot.objects.create(user=user, firebase_path=firebase_path, firebase_url=firebase_url)