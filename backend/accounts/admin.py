from django.contrib import admin
from .models import (
    CustomUser, UserFollow, UserBlock, MissionCondition, Mission, 
    UserMission, UserConditionRecord, Achievement, UserAchievement, 
    Notification, Plan
)

# 自定義用戶管理
@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'user_fullname', 'user_account', 'points', 'is_active')
    search_fields = ('username', 'email', 'user_fullname', 'user_account')
    list_filter = ('is_active', 'is_staff')
    readonly_fields = ('date_joined', 'last_login')
    fieldsets = (
        ('基本信息', {'fields': ('username', 'email', 'password')}),
        ('個人資料', {'fields': ('user_fullname', 'user_account', 'user_intro')}),
        ('系統狀態', {'fields': ('points', 'is_active', 'is_staff', 'is_superuser', 'date_joined', 'last_login')}),
    )

# 用戶追蹤管理
@admin.register(UserFollow)
class UserFollowAdmin(admin.ModelAdmin):
    list_display = ('user', 'follows', 'date', 'confirm_or_not')
    list_filter = ('date', 'confirm_or_not')
    search_fields = ('user__username', 'follows__username')

# 用戶封鎖管理
@admin.register(UserBlock)
class UserBlockAdmin(admin.ModelAdmin):
    list_display = ('blocker', 'blocked', 'date')
    list_filter = ('date',)
    search_fields = ('blocker__username', 'blocked__username')

# 任務條件管理
@admin.register(MissionCondition)
class MissionConditionAdmin(admin.ModelAdmin):
    list_display = ('name', 'type', 'target_count')
    list_filter = ('type',)
    search_fields = ('name', 'description')

# 任務管理
@admin.register(Mission)
class MissionAdmin(admin.ModelAdmin):
    list_display = ('mission_name', 'point', 'level')
    search_fields = ('mission_name', 'description')
    list_filter = ('level',)
    filter_horizontal = ('conditions',)

# 用戶任務管理
@admin.register(UserMission)
class UserMissionAdmin(admin.ModelAdmin):
    list_display = ('user', 'mission', 'status', 'due', 'date_assigned', 'date_achieved')
    list_filter = ('status', 'due', 'date_assigned')
    search_fields = ('user__username', 'mission__mission_name')
    readonly_fields = ('date_assigned',)

# 用戶條件記錄管理
@admin.register(UserConditionRecord)
class UserConditionRecordAdmin(admin.ModelAdmin):
    list_display = ('user', 'condition', 'count', 'timestamp')
    list_filter = ('timestamp',)
    search_fields = ('user__username', 'condition__name')
    readonly_fields = ('timestamp',)

# 成就管理
@admin.register(Achievement)
class AchievementAdmin(admin.ModelAdmin):
    list_display = ('achievement_name', 'description', 'reward')
    search_fields = ('achievement_name', 'description', 'reward')

# 用戶成就管理
@admin.register(UserAchievement)
class UserAchievementAdmin(admin.ModelAdmin):
    list_display = ('user', 'achievement', 'date_achieved')
    list_filter = ('date_achieved',)
    search_fields = ('user__username', 'achievement__achievement_name')
    readonly_fields = ('date_achieved',)

# 通知管理
@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'notification_type', 'content', 'date', 'is_read')
    list_filter = ('notification_type', 'date', 'is_read')
    search_fields = ('user__username', 'content')
    readonly_fields = ('date',)

# 行程管理
@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ('user', 'title', 'date', 'is_completed')
    list_filter = ('date', 'is_completed')
    search_fields = ('user__username', 'title', 'description')
