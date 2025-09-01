from django.contrib import admin
from .models import (
    Checkpoint, Mission, MissionCheckpoint, CheckIn, 
    CoinTransaction, UserCoinBalance, Auction, AuctionBid, DisplayRight
)
from media.models import CheckpointDisplayImage


@admin.register(Checkpoint)
class CheckpointAdmin(admin.ModelAdmin):
    """站點管理"""
    list_display = ['name', 'latitude', 'longitude', 'status', 'total_checkins', 'popularity_score', 'base_bid_price']
    list_filter = ['status', 'created_at']
    search_fields = ['name', 'description']
    readonly_fields = ['id', 'total_checkins', 'popularity_score', 'created_at', 'updated_at']
    fieldsets = (
        ('基本資訊', {
            'fields': ('id', 'name', 'description', 'status')
        }),
        ('地理位置', {
            'fields': ('latitude', 'longitude', 'radius')
        }),
        ('競標設定', {
            'fields': ('base_bid_price',)
        }),
        ('統計資訊', {
            'fields': ('total_checkins', 'popularity_score')
        }),
        ('時間戳記', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )


class MissionCheckpointInline(admin.TabularInline):
    """任務站點內聯編輯"""
    model = MissionCheckpoint
    extra = 0
    readonly_fields = ['is_completed', 'completed_at']


@admin.register(Mission)
class MissionAdmin(admin.ModelAdmin):
    """任務管理"""
    list_display = ['title', 'user', 'type', 'difficulty', 'status', 'progress', 'reward_coins', 'expires_at']
    list_filter = ['type', 'difficulty', 'status', 'created_at']
    search_fields = ['title', 'user__username', 'description']
    readonly_fields = ['id', 'completion_percentage', 'is_expired', 'created_at', 'completed_at']
    inlines = [MissionCheckpointInline]
    
    fieldsets = (
        ('基本資訊', {
            'fields': ('id', 'user', 'title', 'description')
        }),
        ('任務設定', {
            'fields': ('type', 'difficulty', 'required_checkins', 'progress', 'completion_percentage')
        }),
        ('獎勵設定', {
            'fields': ('reward_coins', 'bonus_reward')
        }),
        ('狀態管理', {
            'fields': ('status', 'is_expired')
        }),
        ('時間管理', {
            'fields': ('created_at', 'expires_at', 'completed_at')
        })
    )


@admin.register(CheckIn)
class CheckInAdmin(admin.ModelAdmin):
    """簽到記錄管理"""
    list_display = ['user', 'checkpoint', 'mission', 'timestamp', 'distance_to_checkpoint', 'is_valid']
    list_filter = ['is_valid', 'timestamp', 'checkpoint__status']
    search_fields = ['user__username', 'checkpoint__name', 'mission__title']
    readonly_fields = ['id', 'distance_to_checkpoint', 'timestamp']
    
    fieldsets = (
        ('基本資訊', {
            'fields': ('id', 'user', 'checkpoint', 'mission', 'timestamp')
        }),
        ('位置資訊', {
            'fields': ('user_latitude', 'user_longitude', 'location_accuracy', 'distance_to_checkpoint')
        }),
        ('驗證資訊', {
            'fields': ('is_valid', 'validation_notes', 'ip_address', 'user_agent')
        })
    )


@admin.register(CoinTransaction)
class CoinTransactionAdmin(admin.ModelAdmin):
    """金幣交易管理"""
    list_display = ['user', 'type', 'amount', 'balance_after', 'reason', 'created_at']
    list_filter = ['type', 'created_at', 'reference_type']
    search_fields = ['user__username', 'reason', 'reference_id']
    readonly_fields = ['id', 'balance_before', 'balance_after', 'created_at']
    
    fieldsets = (
        ('基本資訊', {
            'fields': ('id', 'user', 'type', 'amount')
        }),
        ('餘額變化', {
            'fields': ('balance_before', 'balance_after')
        }),
        ('交易原因', {
            'fields': ('reason', 'reference_type', 'reference_id')
        }),
        ('時間戳記', {
            'fields': ('created_at',)
        })
    )


@admin.register(UserCoinBalance)
class UserCoinBalanceAdmin(admin.ModelAdmin):
    """使用者金幣餘額管理"""
    list_display = ['user', 'balance', 'total_earned', 'total_spent', 'last_updated']
    search_fields = ['user__username']
    readonly_fields = ['last_updated']


class AuctionBidInline(admin.TabularInline):
    """競標出價內聯編輯"""
    model = AuctionBid
    extra = 0
    readonly_fields = ['timestamp']


@admin.register(Auction)
class AuctionAdmin(admin.ModelAdmin):
    """競標管理"""
    list_display = ['checkpoint', 'title', 'status', 'min_bid', 'current_bid', 'current_bidder', 'end_date']
    list_filter = ['status', 'start_date', 'end_date']
    search_fields = ['checkpoint__name', 'title', 'current_bidder__username']
    readonly_fields = ['id', 'is_active', 'created_at', 'updated_at']
    inlines = [AuctionBidInline]
    
    fieldsets = (
        ('基本資訊', {
            'fields': ('id', 'checkpoint', 'title', 'description')
        }),
        ('競標設定', {
            'fields': ('min_bid', 'current_bid', 'current_bidder', 'display_duration_days')
        }),
        ('時間設定', {
            'fields': ('start_date', 'end_date', 'is_active')
        }),
        ('狀態管理', {
            'fields': ('status', 'winner')
        }),
        ('時間戳記', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )


@admin.register(DisplayRight)
class DisplayRightAdmin(admin.ModelAdmin):
    """展示權管理"""
    list_display = ['checkpoint', 'user', 'start_date', 'end_date', 'status', 'acquired_through', 'days_remaining']
    list_filter = ['status', 'acquired_through', 'start_date', 'end_date']
    search_fields = ['checkpoint__name', 'user__username']
    readonly_fields = ['id', 'is_active', 'days_remaining', 'created_at', 'updated_at']
    
    fieldsets = (
        ('基本資訊', {
            'fields': ('id', 'checkpoint', 'user', 'auction')
        }),
        ('展示期間', {
            'fields': ('start_date', 'end_date', 'days_remaining', 'is_active')
        }),
        ('狀態管理', {
            'fields': ('status', 'acquired_through')
        }),
        ('時間戳記', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )


@admin.register(CheckpointDisplayImage)
class CheckpointDisplayImageAdmin(admin.ModelAdmin):
    """站點展示圖片管理"""
    list_display = ['display_right', 'checkpoint_name', 'user_name', 'is_active', 'is_display_active', 'caption']
    list_filter = ['is_active', 'uploaded_at']
    search_fields = ['display_right__checkpoint__name', 'display_right__user__username', 'caption']
    readonly_fields = ['uploaded_at', 'updated_at', 'is_display_active', 'days_remaining']
    
    fieldsets = (
        ('基本資訊', {
            'fields': ('display_right', 'firebase_url', 'firebase_path')
        }),
        ('展示設定', {
            'fields': ('caption', 'is_active', 'is_display_active', 'days_remaining')
        }),
        ('來源資訊', {
            'fields': ('source_content_type', 'source_object_id', 'original_filename', 'content_type_mime', 'file_size')
        }),
        ('其他資訊', {
            'fields': ('alt_text', 'uploaded_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )
    
    def checkpoint_name(self, obj):
        return obj.display_right.checkpoint.name if obj.display_right else '-'
    checkpoint_name.short_description = '站點名稱'
    
    def user_name(self, obj):
        return obj.display_right.user.username if obj.display_right else '-'
    user_name.short_description = '使用者'


# 自定義管理頁面標題
admin.site.site_header = "PetApp 互動城市管理系統"
admin.site.site_title = "互動城市管理"
admin.site.index_title = "歡迎使用互動城市管理系統"