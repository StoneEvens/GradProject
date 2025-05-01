from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from gradProject import settings
from pets.models import Pet

class Image(models.Model):
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')

    img_url = models.TextField()  # 圖片網址
    sort_order = models.IntegerField(default=0)
    alt_text = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return f"Image for {self.content_type} {self.object_id} (sort {self.sort_order})"

class PetHeadshot(models.Model):
    pet = models.OneToOneField(Pet, on_delete=models.CASCADE, related_name='headshot')
    img_url = models.TextField()  
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Headshot of {self.pet.pet_name}"

class UserHeadshot(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='headshot')
    img_url = models.TextField()  
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Headshot of {self.user.username}"