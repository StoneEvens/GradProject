from django.db import models
from django.contrib.auth.models import User


class Pet(models.Model):
    name = models.CharField(max_length=100, null=True, blank=True)
    pet_avatar = models.ImageField(upload_to='pet_avatars/', null=True, blank=True)  # 頭貼
    is_dog = models.BooleanField(default=False)  # True=狗，False=貓
    life_stage = models.CharField(max_length=20)  # 'adult'、'puppy' 等
    weight = models.FloatField()
    expect_adult_weight = models.FloatField(null=True, blank=True)
    litter_size = models.IntegerField(null=True, blank=True)
    weeks_of_lactation = models.IntegerField(null=True, blank=True)

    # 外鍵關聯到使用者
    keeper_id = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pets"
    )

    def __str__(self):
        return f"{self.name or '寵物'} ({'狗' if self.is_dog else '貓'}, {self.life_stage})"
