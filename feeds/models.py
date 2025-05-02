from django.db import models
from django.conf import settings
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()

# === 飼料資訊 ===
class Feed(models.Model):
    # 處理狀態選項
    PROCESSING_STATUS_CHOICES = [
        ('pending', '待處理'),
        ('processing', '處理中'),
        ('completed', '處理完成'),
        ('completed_with_warnings', '處理完成但有警告'),
        ('failed', '處理失敗'),
    ]
    
    feed_name = models.CharField(max_length=100)
    protein = models.FloatField(help_text="蛋白質 (g/100g)", default=0)
    fat = models.FloatField(help_text="脂肪 (g/100g)", default=0)
    calcium = models.FloatField(help_text="鈣 (g/100g)", default=0)
    phosphorus = models.FloatField(help_text="磷 (g/100g)", default=0)
    magnesium = models.FloatField(help_text="鎂 (mg/100g)", default=0)
    sodium = models.FloatField(help_text="鈉 (mg/100g)", default=0)
    carbohydrate = models.FloatField(help_text="碳水化合物 (g/100g)", default=0)  # 計算ME會用到
    extracted_text = models.TextField(blank=True, null=True, help_text="OCR 提取的原始文本")
    processing_status = models.CharField(
        '處理狀態', 
        max_length=25, 
        choices=PROCESSING_STATUS_CHOICES,
        default='pending'
    )
    processing_error = models.TextField('處理錯誤信息', blank=True)
    created_at = models.DateTimeField('創建時間', auto_now_add=True)
    updated_at = models.DateTimeField('更新時間', auto_now=True)

    def __str__(self):
        return self.feed_name

    class Meta:
        verbose_name = '飼料'
        verbose_name_plural = '飼料'
        ordering = ['-created_at']

# === 使用者飼料使用紀錄 ===
class UserFeed(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='feeds',
        verbose_name='用戶'
    )
    feed = models.ForeignKey(
        Feed,
        on_delete=models.CASCADE,
        related_name='users',
        verbose_name='飼料'
    )
    last_used = models.DateTimeField('最近使用時間', default=timezone.now)

    def __str__(self):
        return f"{self.user.username} - {self.feed.feed_name}"

    class Meta:
        verbose_name = '用戶飼料'
        verbose_name_plural = '用戶飼料'
        unique_together = ['user', 'feed']
        ordering = ['-last_used']

