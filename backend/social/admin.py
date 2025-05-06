from django.contrib import admin
from .models import Post, PostHashtag

# 貼文管理
@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'content_preview', 'popularity', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('user__username', 'content')
    readonly_fields = ('created_at', 'updated_at')
    date_hierarchy = 'created_at'
    
    def content_preview(self, obj):
        """顯示內容的預覽"""
        max_length = 50
        if len(obj.content) > max_length:
            return f"{obj.content[:max_length]}..."
        return obj.content
    content_preview.short_description = '內容預覽'

# 貼文標籤管理
@admin.register(PostHashtag)
class PostHashtagAdmin(admin.ModelAdmin):
    list_display = ('tag', 'post')
    search_fields = ('tag', 'post__content')
    list_filter = ('tag',)
