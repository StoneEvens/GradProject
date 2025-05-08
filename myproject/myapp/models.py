from django.db import models

# Create your models here.
# 使用者
class User(models.Model):
    user_password = models.CharField(max_length=20)
    user_name = models.CharField(max_length=10)
    user_mail = models.EmailField()
    user_point = models.IntegerField()
    user_intro = models.TextField()
    user_image_url = models.TextField()

    def __str__(self):
        return self.name

# 成就模型
class Achievement(models.Model):
    title = models.CharField(max_length=100)  # 成就名稱
    description = models.TextField()          # 成就描述
    reward = models.CharField(max_length=100)  # 頭框樣式

    def __str__(self):
        return self.title

# 使用者成就模型 (中介表)
class UserAchievement(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)  # 連結到User
    achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE)  # 連結到Achievement
    achieved_at = models.DateTimeField(auto_now_add=True)  # 達成時間
    progress = models.IntegerField(default=0)  # 成就進度 (0~100)

    def __str__(self):
        return f"{self.user.username} - {self.achievement.title}"

    class Meta:
        unique_together = ('user', 'achievement')  # 設定聯合唯一鍵