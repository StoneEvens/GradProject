from django.db import models
from gradProject import settings
from django.contrib.auth.models import AbstractUser
from django.db.models import Q

# 使用者模型：擴充自 Django AbstractUser
class CustomUser(AbstractUser):
    # 擴充使用者欄位
    points = models.IntegerField(default=0)
    user_intro = models.TextField(blank=True, null=True)  # 使用者自我介紹
    user_fullname = models.CharField(max_length=150, blank=True)  # 使用者真實姓名
    user_account = models.CharField(max_length=150, unique=True)  # 唯一帳號
    
    def __str__(self):
        return self.username

    def add_points(self, user_account, points_to_add):
        user = self._search_users(user_account).first()
        if user:
            user.points += points_to_add
            user.save(update_fields=['points'])
            return user.points
        return None

    def search_users(self, query):
        return self.objects.filter(
            Q(username__icontains=query) | 
            Q(user_fullname__icontains=query) |
            Q(user_account__icontains=query)
        )

# 使用者追蹤功能
class UserFollow(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='following'
    )
    follows = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='followers'
    )
    date = models.DateField(auto_now_add=True)
    confirm_or_not = models.BooleanField(default=False)

    class Meta:
        unique_together = ('user', 'follows')

# 使用者封鎖功能
class UserBlock(models.Model):
    blocker = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='blocking'
    )
    blocked = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='blocked_by'
    )
    date = models.DateField(auto_now_add=True)

    class Meta:
        unique_together = ('blocker', 'blocked')

    def __str__(self):
        return f"{self.blocker.username} blocked {self.blocked.username}"

# 任務條件類型
class MissionCondition(models.Model):
    CONDITION_TYPE_CHOICES = [
        ('post', '發布貼文'),
        ('comment', '評論'),
        ('login', '登入'),
        ('follow', '追蹤用戶'),
        ('profile', '完善個人資料'),
        ('archive', '建立病歷檔案'),
        ('like', '點讚'),
        ('visit', '訪問頁面'),
        ('read', '閱讀文章'),
        ('custom', '自定義條件')
    ]
    
    type = models.CharField(max_length=20, choices=CONDITION_TYPE_CHOICES)
    name = models.CharField(max_length=100)
    description = models.TextField()
    target_count = models.IntegerField(default=1)  # 目標次數，例如發布3篇文章
    target_entity = models.CharField(max_length=100, blank=True, null=True)  # 目標實體，例如特定頁面ID
    custom_validation_code = models.TextField(blank=True, null=True)  # 自定義驗證代碼或邏輯描述
    
    def __str__(self):
        return f"{self.name} ({self.type})"

# 每日任務
class Mission(models.Model):
    MISSION_LEVEL_CHOICES = [
        ('low', '初級任務 (0-300分)'),
        ('high', '高級任務 (301-500分)')
    ]
    
    mission_name = models.CharField(max_length=100)
    description = models.TextField()
    point = models.IntegerField()
    level = models.CharField(max_length=10, choices=MISSION_LEVEL_CHOICES, default='low')
    conditions = models.ManyToManyField(MissionCondition, related_name='missions', blank=True)
    
    def __str__(self):
        return self.mission_name

# 使用者與每日任務關聯
class UserMission(models.Model):
    STATUS_CHOICES = [
        ('pending', '進行中'),
        ('completed', '已完成'),
        ('expired', '已過期')
    ]
    
    mission = models.ForeignKey(
        Mission,
        on_delete=models.CASCADE,
        related_name='assigned_users'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='missions'
    )
    due = models.DateField()
    date_assigned = models.DateField(auto_now_add=True)
    date_achieved = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    condition_progress = models.JSONField(default=dict, blank=True)  # 儲存每個條件的完成進度
    
    class Meta:
        unique_together = ('mission', 'user', 'due')  

    def __str__(self):
        return f"{self.user.username} - {self.mission.mission_name} (Due: {self.due})" 

# 使用者完成條件記錄
class UserConditionRecord(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='condition_records'
    )
    condition = models.ForeignKey(
        MissionCondition,
        on_delete=models.CASCADE,
        related_name='user_records'
    )
    user_mission = models.ForeignKey(
        UserMission,
        on_delete=models.CASCADE,
        related_name='condition_records',
        null=True,
        blank=True
    )
    count = models.IntegerField(default=1)  # 完成次數
    timestamp = models.DateTimeField(auto_now_add=True)
    details = models.JSONField(default=dict, blank=True)  # 額外詳細資訊
    
    def __str__(self):
        return f"{self.user.username} - {self.condition.name} ({self.timestamp})"

# 成就
class Achievement(models.Model):
    achievement_name = models.CharField(max_length=100)
    description = models.CharField(max_length=255)
    reward = models.CharField(max_length=100) 

    def __str__(self):
        return self.achievement_name 

# 使用者與成就關聯 
class UserAchievement(models.Model):
    achievement = models.ForeignKey(
        Achievement,
        on_delete=models.CASCADE,
        related_name='user_achievements'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='achievements'
    )
    date_achieved = models.DateField(auto_now_add=True)

    class Meta:
        unique_together = ('achievement', 'user')  

    def __str__(self):
        return f"{self.user.username} - {self.achievement.achievement_name}" 

# 系統通知模型（資訊、警告、自定義類型）
class Notification(models.Model):
    NOTIFICATION_TYPES = [
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('alert', 'Alert'),
        ('custom', 'Custom'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    notification_type = models.CharField(max_length=50, choices=NOTIFICATION_TYPES)
    content = models.CharField(max_length=255)
    date = models.DateField(auto_now_add=True)
    is_read = models.BooleanField(default=False) 

    def __str__(self):
        return f"{self.user.username} - {self.notification_type}: {self.content[:20]}"

# 當日行程
class Plan(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='plans'
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    date = models.DateField()  # 改為只存儲日期
    start_time = models.TimeField(default='08:00')  # 預設早上 8 點
    end_time = models.TimeField(default='09:00')  # 預設早上 9 點
    is_completed = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.username}'s Plan: {self.title} ({self.date})"
    