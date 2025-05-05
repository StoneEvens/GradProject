from django.db import models
from django.conf import settings
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from pets.models import Pet

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
    popularity = models.IntegerField(default=0, help_text="熱度，主要由點讚數決定")
    created_at = models.DateTimeField('創建時間', auto_now_add=True)
    updated_at = models.DateTimeField('更新時間', auto_now=True)

    def __str__(self):
        return self.feed_name

    class Meta:
        verbose_name = '飼料'
        verbose_name_plural = '飼料'
        ordering = ['-created_at']
    
    def get_interaction_stats(self):
        """
        獲取飼料/疾病檔案的互動統計
        """
        from interactions.models import UserInteraction
        
        feed_type = ContentType.objects.get_for_model(Feed)
        
        upvotes = UserInteraction.objects.filter(
            content_type=feed_type,
            object_id=self.id,
            relation='upvoted'
        ).count()
        
        downvotes = UserInteraction.objects.filter(
            content_type=feed_type,
            object_id=self.id,
            relation='downvoted'
        ).count()
        
        saves = UserInteraction.objects.filter(
            content_type=feed_type,
            object_id=self.id,
            relation='saved'
        ).count()
        
        shares = UserInteraction.objects.filter(
            content_type=feed_type,
            object_id=self.id,
            relation='shared'
        ).count()
        
        return {
            'upvotes': upvotes,
            'downvotes': downvotes,
            'saves': saves,
            'shares': shares,
            'total_score': upvotes - downvotes
        }
    
    def check_user_interaction(self, user, relation):
        """
        檢查用戶是否對飼料/疾病檔案有特定互動
        """
        if not user or not user.is_authenticated:
            return False
            
        from interactions.models import UserInteraction
        
        feed_type = ContentType.objects.get_for_model(Feed)
        return UserInteraction.objects.filter(
            user=user,
            content_type=feed_type,
            object_id=self.id,
            relation=relation
        ).exists()

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

# === 寵物飼料使用紀錄 ===
class PetFeed(models.Model):
    pet = models.ForeignKey(
        Pet,
        on_delete=models.CASCADE,
        related_name='pet_feeds',
        verbose_name='寵物'
    )
    feed = models.ForeignKey(
        Feed,
        on_delete=models.CASCADE,
        related_name='pet_users',
        verbose_name='飼料'
    )
    last_used = models.DateTimeField('最近使用時間', default=timezone.now)
    is_current = models.BooleanField('是否為目前使用中', default=True)
    notes = models.TextField('備註', blank=True, null=True)
    
    def __str__(self):
        return f"{self.pet.pet_name} - {self.feed.feed_name}"
    
    def save(self, *args, **kwargs):
        # 如果此記錄被標記為當前使用中，則將同一寵物的其他記錄設為非當前使用
        if self.is_current:
            PetFeed.objects.filter(pet=self.pet, is_current=True).exclude(id=self.id).update(is_current=False)
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = '寵物飼料'
        verbose_name_plural = '寵物飼料'
        unique_together = ['pet', 'feed']
        ordering = ['-last_used']

