from django.contrib import admin
from .models import Post, PostHashtag, PostFrame

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
    list_display = ('tag', 'postFrame')
    search_fields = ('tag', 'post__content')
    list_filter = ('tag',)

@admin.register(PostFrame)
class PostFrameAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'upvotes', 'downvotes', 'saves', 'shares', 'created_at', 'updated_at')
    list_filter = ('created_at', 'user')
    readonly_fields = ('created_at', 'updated_at')
    date_hierarchy = 'created_at'
    
    def post_content(self, obj):
        """顯示貼文內容的預覽"""
        return obj.post.content[:50] + '...' if len(obj.post.content) > 50 else obj.post.content
    post_content.short_description = '貼文內容預覽'
