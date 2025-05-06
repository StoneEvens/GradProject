from django.contrib import admin
from .models import Feed, UserFeed, PetFeed

# 飼料資訊管理
@admin.register(Feed)
class FeedAdmin(admin.ModelAdmin):
    list_display = ('feed_name', 'protein', 'fat', 'calcium', 'phosphorus', 'processing_status', 'created_at')
    list_filter = ('processing_status',)
    search_fields = ('feed_name',)
    date_hierarchy = 'created_at'
    readonly_fields = ('created_at', 'updated_at')

# 使用者飼料管理
@admin.register(UserFeed)
class UserFeedAdmin(admin.ModelAdmin):
    list_display = ('user', 'feed', 'last_used')
    list_filter = ('last_used',)
    search_fields = ('user__username', 'feed__feed_name')
    date_hierarchy = 'last_used'

# 寵物飼料管理
@admin.register(PetFeed)
class PetFeedAdmin(admin.ModelAdmin):
    list_display = ('pet', 'feed', 'last_used', 'is_current')
    list_filter = ('is_current', 'last_used')
    search_fields = ('pet__pet_name', 'feed__feed_name')
    date_hierarchy = 'last_used'
    readonly_fields = ('last_used',)
