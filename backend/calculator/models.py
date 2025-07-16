from django.db import models
from django.conf import settings


class Pet(models.Model):
    pet_name = models.CharField(max_length=100, null=True, blank=True)
    pet_avatar = models.URLField(
        max_length=500,
        null=True,
        blank=True,
        help_text="Firebase 上傳後的圖片 URL"
    )
    is_dog = models.BooleanField(default=False)  # True=狗，False=貓
    pet_stage = models.CharField(max_length=20)  # 'adult'、'puppy' 等
    weight = models.FloatField()
    height = models.FloatField(null=True, blank=True)
    predicted_adult_weight = models.FloatField(null=True, blank=True)
    weeks_of_lactation = models.IntegerField(null=True, blank=True)

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="calculator_pets"
    )

    def __str__(self):
        return f"{self.pet_name or '寵物'} ({'狗' if self.is_dog else '貓'}, {self.pet_stage})"