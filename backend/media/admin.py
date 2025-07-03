from django.contrib import admin
from .models import Image, PetHeadshot, UserHeadshot

# 圖片管理 - Firebase Storage 版本
@admin.register(Image)
class ImageAdmin(admin.ModelAdmin):
    list_display = ('id', 'firebase_url_preview', 'sort_order', 'uploaded_at')
    list_filter = ('uploaded_at', 'content_type_mime')
    search_fields = ('firebase_url', 'firebase_path', 'alt_text', 'original_filename')
    readonly_fields = ('uploaded_at', 'updated_at')
    ordering = ('id', 'sort_order')
    
    fieldsets = (
        ('基本資訊', {
            'fields': ('id', 'sort_order', 'alt_text')
        }),
        ('Firebase Storage', {
            'fields': ('firebase_url', 'firebase_path')
        }),
        ('檔案資訊', {
            'fields': ('original_filename', 'file_size', 'content_type_mime')
        }),
        ('時間戳記', {
            'fields': ('uploaded_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def firebase_url_preview(self, obj):
        """顯示 Firebase URL 的預覽"""
        max_length = 50
        if obj.firebase_url and len(obj.firebase_url) > max_length:
            return f"{obj.firebase_url[:max_length]}..."
        return obj.firebase_url or "無"
    firebase_url_preview.short_description = 'Firebase URL 預覽'

# 寵物頭像管理 - Firebase Storage 版本
@admin.register(PetHeadshot)
class PetHeadshotAdmin(admin.ModelAdmin):
    list_display = ('id', 'pet', 'firebase_url_preview', 'uploaded_at')
    search_fields = ('pet__pet_name', 'firebase_url', 'firebase_path')
    readonly_fields = ('uploaded_at',)
    
    fieldsets = (
        ('基本資訊', {
            'fields': ('pet',)
        }),
        ('Firebase Storage', {
            'fields': ('firebase_url', 'firebase_path')
        }),
        ('時間戳記', {
            'fields': ('uploaded_at',),
            'classes': ('collapse',)
        }),
    )
    
    def firebase_url_preview(self, obj):
        """顯示 Firebase URL 的預覽"""
        max_length = 50
        if obj.firebase_url and len(obj.firebase_url) > max_length:
            return f"{obj.firebase_url[:max_length]}..."
        return obj.firebase_url or "無"
    firebase_url_preview.short_description = 'Firebase URL 預覽'

# 用戶頭像管理 - Firebase Storage 版本
@admin.register(UserHeadshot)
class UserHeadshotAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'firebase_url_preview', 'uploaded_at')
    search_fields = ('user__username', 'firebase_url', 'firebase_path')
    readonly_fields = ('uploaded_at',)
    
    fieldsets = (
        ('基本資訊', {
            'fields': ('user',)
        }),
        ('Firebase Storage', {
            'fields': ('firebase_url', 'firebase_path')
        }),
        ('時間戳記', {
            'fields': ('uploaded_at',),
            'classes': ('collapse',)
        }),
    )
    
    def firebase_url_preview(self, obj):
        """顯示 Firebase URL 的預覽"""
        max_length = 50
        if obj.firebase_url and len(obj.firebase_url) > max_length:
            return f"{obj.firebase_url[:max_length]}..."
        return obj.firebase_url or "無"
    firebase_url_preview.short_description = 'Firebase URL 預覽'
