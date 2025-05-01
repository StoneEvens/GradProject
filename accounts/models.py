from django.db import models
from gradProject import settings
from django.contrib.auth.models import AbstractUser

# 使用者模型：擴充自 Django AbstractUser
class CustomUser(AbstractUser):
    # 擴充使用者欄位
    points = models.IntegerField(default=0)
    user_intro = models.TextField(blank=True, null=True)  # 使用者自我介紹
    user_fullname = models.CharField(max_length=150, blank=True)  # 使用者真實姓名
    user_account = models.CharField(max_length=150, unique=True)  # 唯一帳號
    
    def __str__(self):
        return self.username

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

# 每日任務
class Mission(models.Model):
    mission_name = models.CharField(max_length=100)
    description = models.TextField()
    point = models.IntegerField()

    def __str__(self):
        return self.mission_name

# 使用者與每日任務關聯
class UserMission(models.Model):
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
    date_achieved = models.DateField(null=True, blank=True)

    class Meta:
        unique_together = ('mission', 'user', 'due')  

    def __str__(self):
        return f"{self.user.username} - {self.mission.mission_name} (Due: {self.due})" 

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
    date = models.DateTimeField()  
    is_completed = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.username}'s Plan: {self.title} ({self.date})"
    