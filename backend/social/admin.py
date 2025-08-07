from django.contrib import admin
from .models import PostHashtag, PostFrame, SoLContent, PostPets, ImageAnnotation, Interactables

# 貼文標籤管理
@admin.register(PostHashtag)
class PostHashtagAdmin(admin.ModelAdmin):
    list_display = ('tag', 'postFrame')
    search_fields = ('tag', 'postFrame__contents__content_text')
    list_filter = ('tag',)

@admin.register(Interactables)
class InteractablesAdmin(admin.ModelAdmin):
    list_display = ('id',)
    search_fields = ('id',)

# 貼文框架管理
@admin.register(PostFrame)
class PostFrameAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'upvotes', 'downvotes', 'saves', 'shares', 'created_at', 'updated_at', 'post_content')
    list_filter = ('created_at', 'user')
    readonly_fields = ('created_at', 'updated_at')
    date_hierarchy = 'created_at'
    
    def post_content(self, obj):
        """顯示貼文內容的預覽"""
        content = obj.contents.first()
        if content:
            text = content.content_text
            return text[:50] + '...' if len(text) > 50 else text
        return "無內容"
    post_content.short_description = '貼文內容預覽'

# 貼文內容管理
@admin.register(SoLContent)
class SoLContentAdmin(admin.ModelAdmin):
    list_display = ('id', 'postFrame', 'content_preview', 'get_user')
    search_fields = ('content_text', 'postFrame__user__username')
    list_filter = ('postFrame__created_at',)
    
    def content_preview(self, obj):
        """內容預覽"""
        return obj.content_text[:100] + '...' if len(obj.content_text) > 100 else obj.content_text
    content_preview.short_description = '內容預覽'
    
    def get_user(self, obj):
        """獲取貼文作者"""
        return obj.postFrame.user.username
    get_user.short_description = '作者'

# 貼文寵物標記管理
@admin.register(PostPets)
class PostPetsAdmin(admin.ModelAdmin):
    list_display = ('postFrame', 'pet', 'get_user', 'get_created_at')
    search_fields = ('pet__pet_name', 'postFrame__user__username')
    list_filter = ('postFrame__created_at',)
    
    def get_user(self, obj):
        """獲取貼文作者"""
        return obj.postFrame.user.username
    get_user.short_description = '貼文作者'
    
    def get_created_at(self, obj):
        """獲取創建時間"""
        return obj.postFrame.created_at
    get_created_at.short_description = '創建時間'

# 圖片標註管理
@admin.register(ImageAnnotation)
class ImageAnnotationAdmin(admin.ModelAdmin):
    list_display = ('id', 'dynamic_name', 'target_type', 'target_id', 'created_by', 'firebase_url_preview', 'created_at')
    search_fields = ('created_by__username', 'firebase_url')
    list_filter = ('target_type', 'created_at', 'created_by')
    readonly_fields = ('created_at', 'updated_at', 'dynamic_name')
    date_hierarchy = 'created_at'
    
    def firebase_url_preview(self, obj):
        """Firebase URL 預覽"""
        return obj.firebase_url[:50] + '...' if len(obj.firebase_url) > 50 else obj.firebase_url
    firebase_url_preview.short_description = 'Firebase URL'
