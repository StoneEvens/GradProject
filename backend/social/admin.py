from django.contrib import admin
from .models import PostHashtag, PostFrame

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
