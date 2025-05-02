from django.db import models
from django.conf import settings

# === 飼料資訊 ===
class Feed(models.Model):
    feed_name = models.CharField(max_length=100)

    protein = models.FloatField(help_text="蛋白質 (g/100g)")
    fat = models.FloatField(help_text="脂肪 (g/100g)")
    calcium = models.FloatField(help_text="鈣 (g/100g)")
    phosphorus = models.FloatField(help_text="磷 (g/100g)")
    magnesium = models.FloatField(help_text="鎂 (mg/100g)")
    sodium = models.FloatField(help_text="鈉 (mg/100g)")
    carbohydrate = models.FloatField(help_text="碳水化合物 (g/100g)")  # 計算ME會用到
    extracted_text = models.TextField(blank=True, null=True, help_text="OCR 提取的原始文本")

    def __str__(self):
        return self.feed_name

# === 使用者飼料使用紀錄 ===
class UserFeed(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='user_feeds'
    )
    feed = models.ForeignKey(
        Feed,
        on_delete=models.CASCADE,
        related_name='used_by_users'
    )
    last_used_date = models.DateField()

    class Meta:
        unique_together = ('user', 'feed')

    def __str__(self):
        return f"{self.user.username} used {self.feed.feed_name} on {self.last_used_date}"

