# feeds/models.py

from django.db import models
from django.conf import settings
from django.utils import timezone

class Feed(models.Model):
    """共用飼料資料庫模型"""
    
    PET_TYPE_CHOICES = [
        ('cat', '貓'),
        ('dog', '狗'),
    ]
    
    name = models.CharField(max_length=100, null=True, blank=True)
    brand = models.CharField(max_length=100, null=True, blank=True)
    pet_type = models.CharField(max_length=10, choices=PET_TYPE_CHOICES, default='cat')
    
    # 營養素
    protein = models.FloatField(default=0)
    fat = models.FloatField(default=0)
    carbohydrate = models.FloatField(default=0)
    calcium = models.FloatField(default=0)
    phosphorus = models.FloatField(default=0)
    magnesium = models.FloatField(default=0)
    sodium = models.FloatField(default=0)
    
    # 價錢
    price = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0,
        help_text="飼料價格"
    )

    # 注意：圖片現在由 media.models.FeedImage 模型管理
    
    # 建立與更新時間
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    # 建立者（首次上傳的使用者）
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_feeds"
    )
    
    # 審核相關欄位
    review_count = models.PositiveIntegerField(
        default=0,
        help_text="已審核人數"
    )
    is_verified = models.BooleanField(
        default=False,
        help_text="是否審核通過（需要5人確認）"
    )

    class Meta:
        # 確保同品牌、同名稱、同寵物類型的飼料不重複
        unique_together = ['name', 'brand', 'pet_type']
        indexes = [
            models.Index(fields=['pet_type', 'brand']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        pet_type_display = dict(self.PET_TYPE_CHOICES).get(self.pet_type, self.pet_type)
        return f"{self.brand} - {self.name} ({pet_type_display})" if self.brand and self.name else f"Feed #{self.id}"


class UserFeed(models.Model):
    """使用者與飼料的關係表（以寵物為單位）"""
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="user_feeds"
    )
    feed = models.ForeignKey(
        Feed,
        on_delete=models.CASCADE,
        related_name="user_relationships"
    )
    pet = models.ForeignKey(
        'pets.Pet',
        on_delete=models.CASCADE,
        related_name="pet_feeds",
        help_text="使用此飼料的寵物",
        null=True,  # 暫時允許 null，稍後在 migration 中處理
        blank=True
    )
    
    # 使用統計
    usage_count = models.PositiveIntegerField(default=0)
    last_used_at = models.DateTimeField(default=timezone.now)
    
    # 注意：個人化營養資料已移除，所有修改只在前端進行
    # 資料庫只保留原始的共用飼料資訊
    
    # 時間戳記
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'feed', 'pet']
        indexes = [
            models.Index(fields=['user', 'last_used_at']),
            models.Index(fields=['pet', 'last_used_at']),
            models.Index(fields=['usage_count']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.pet.pet_name} - {self.feed}"
    
    def increment_usage(self):
        """增加使用次數並更新最後使用時間"""
        self.usage_count += 1
        self.last_used_at = timezone.now()
        self.save(update_fields=['usage_count', 'last_used_at'])


class UserFeedRating(models.Model):
    """使用者對飼料的評價"""
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="feed_ratings"
    )
    feed = models.ForeignKey(
        Feed,
        on_delete=models.CASCADE,
        related_name="ratings"
    )
    pet = models.ForeignKey(
        'pets.Pet',
        on_delete=models.CASCADE,
        related_name="feed_ratings",
        help_text="評價此飼料的寵物"
    )
    
    # 評分 (1-5)
    rating = models.IntegerField(
        choices=[(i, i) for i in range(1, 6)],
        help_text="評分 1-5 顆星"
    )
    
    # 評價內容
    content = models.TextField(
        blank=True,
        null=True,
        help_text="評價內容"
    )
    
    # 時間戳記
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['user', 'feed', 'pet']
        indexes = [
            models.Index(fields=['feed', 'rating']),
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['pet', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.user.username} - {self.pet.pet_name} - {self.feed} - {self.rating}星"


class FeedReview(models.Model):
    """飼料審核記錄"""
    
    feed = models.ForeignKey(
        Feed,
        on_delete=models.CASCADE,
        related_name="reviews"
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="feed_reviews"
    )
    
    # 審核時間
    reviewed_at = models.DateTimeField(default=timezone.now)
    
    class Meta:
        unique_together = ['feed', 'reviewer']
        indexes = [
            models.Index(fields=['feed', 'reviewer']),
            models.Index(fields=['reviewed_at']),
        ]
    
    def __str__(self):
        return f"{self.reviewer.username} 審核了 {self.feed}"


class FeedErrorReport(models.Model):
    """飼料錯誤回報"""
    
    ERROR_TYPE_CHOICES = [
        ('name', '名稱錯誤'),
        ('brand', '品牌錯誤'),
        ('nutrition', '營養成分錯誤'),
        ('price', '價格錯誤'),
        ('image', '圖片錯誤'),
        ('multiple', '多項錯誤'),
        ('other', '其他錯誤'),
    ]
    
    feed = models.ForeignKey(
        Feed,
        on_delete=models.CASCADE,
        related_name="error_reports"
    )
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="feed_error_reports"
    )
    
    # 錯誤類型
    error_type = models.CharField(
        max_length=20,
        choices=ERROR_TYPE_CHOICES,
        help_text="錯誤類型"
    )
    
    # 錯誤描述
    description = models.TextField(
        help_text="錯誤描述"
    )
    
    # 原始錯誤資料
    original_data = models.JSONField(
        null=True,
        blank=True,
        help_text="原始錯誤資料"
    )
    
    # 使用者建議的正確資料
    corrected_data = models.JSONField(
        null=True,
        blank=True,
        help_text="使用者建議的正確資料"
    )
    
    # 是否已處理
    is_resolved = models.BooleanField(
        default=False,
        help_text="是否已處理"
    )
    
    # 時間戳記
    reported_at = models.DateTimeField(default=timezone.now)
    resolved_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['feed', 'is_resolved']),
            models.Index(fields=['reporter', 'reported_at']),
            models.Index(fields=['error_type']),
        ]
    
    def __str__(self):
        return f"{self.feed} - {self.get_error_type_display()} - {self.reporter.username}"


class UserFeedMark(models.Model):
    """使用者標記的飼料（不依賴寵物）"""
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="feed_marks"
    )
    feed = models.ForeignKey(
        Feed,
        on_delete=models.CASCADE,
        related_name="user_marks"
    )
    
    # 時間戳記
    created_at = models.DateTimeField(default=timezone.now)
    
    class Meta:
        unique_together = ['user', 'feed']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['feed', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.user.username} 標記了 {self.feed}"