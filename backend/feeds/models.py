# feeds/models.py

from django.db import models
from django.conf import settings

class Feed(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="feeds"
    )
    name = models.CharField(max_length=100, null=True, blank=True)
    brand = models.CharField(max_length=100, null=True, blank=True)
    
    # 營養素
    protein = models.FloatField(default=0)
    fat = models.FloatField(default=0)
    carbohydrate = models.FloatField(default=0)
    calcium = models.FloatField(default=0)
    phosphorus = models.FloatField(default=0)
    magnesium = models.FloatField(default=0)
    sodium = models.FloatField(default=0)

    # 圖片網址（Firebase 上傳後 URL）
    front_image_url = models.URLField(max_length=500, blank=True, null=True)
    nutrition_image_url = models.URLField(max_length=500, blank=True, null=True)

    def __str__(self):
        return self.name or "Feed"