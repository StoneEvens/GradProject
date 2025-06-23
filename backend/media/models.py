from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from gradProject import settings
from pets.models import Pet
from social.models import PostFrame
from accounts.models import CustomUser

class SuperImage(models.Model):
    #Storage Details
    firebase_url = models.URLField(max_length=500, help_text="Firebase Storage 圖片 URL", blank=True, null=True)
    firebase_path = models.CharField(max_length=255, help_text="Firebase Storage 檔案路徑", blank=True, null=True)
    
    #Image Details
    original_filename = models.CharField(max_length=255, blank=True, null=True)
    content_type_mime = models.CharField(max_length=100, blank=True, null=True)
    
    #Sort & Text Replacements
    alt_text = models.CharField(max_length=255, blank=True, help_text="替代文字")
    
    #Time Stamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def url(self):
        return self.firebase_url
    
    def create(self, firebase_path:str):
        self.firebase_path = firebase_path

        self.save(firebase_path)

class Image(SuperImage):
    postFrame = models.ForeignKey(PostFrame, on_delete=models.CASCADE, related_name='images')
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ['object_id', 'sort_order']
        indexes = [
            models.Index(fields=['object_id']),
            models.Index(fields=['firebase_path'])
        ]
    
    def url(self):
        return self.firebase_url
    
    def create(self, postFrame: PostFrame, firebase_path:str):
        super().create(firebase_path=firebase_path)
    
    def get_first_image_url(self, postFrame: PostFrame):
        return self.objects.filter(post_frame=postFrame).order_by('sort_order').first().url


class PetHeadshot(SuperImage):
    pet = models.OneToOneField(Pet, on_delete=models.CASCADE, related_name='headshot')
    
    def url(self, pet:Pet):
        return self.objects.filter(pet=pet).first().firebase_url


class UserHeadshot(SuperImage):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='headshot')
    
    def get_headshot_url(self, user:CustomUser):
        return self.objects.filter(user=user).first().firebase_url