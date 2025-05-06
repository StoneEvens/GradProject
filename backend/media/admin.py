from django.contrib import admin
from .models import Image, PetHeadshot, UserHeadshot

# 圖片管理
@admin.register(Image)
class ImageAdmin(admin.ModelAdmin):
    list_display = ('id', 'content_type', 'object_id', 'img_url_preview', 'created_at')
    list_filter = ('content_type', 'created_at')
    search_fields = ('img_url', 'alt_text')
    readonly_fields = ('created_at', 'updated_at')
    
    def img_url_preview(self, obj):
        """顯示圖片URL的預覽"""
        max_length = 50
        if len(obj.img_url) > max_length:
            return f"{obj.img_url[:max_length]}..."
        return obj.img_url
    img_url_preview.short_description = '圖片URL預覽'

# 寵物頭像管理
@admin.register(PetHeadshot)
class PetHeadshotAdmin(admin.ModelAdmin):
    list_display = ('id', 'pet', 'img_url_preview', 'uploaded_at')
    search_fields = ('pet__pet_name', 'img_url')
    readonly_fields = ('uploaded_at',)
    
    def img_url_preview(self, obj):
        """顯示圖片URL的預覽"""
        max_length = 50
        if len(obj.img_url) > max_length:
            return f"{obj.img_url[:max_length]}..."
        return obj.img_url
    img_url_preview.short_description = '圖片URL預覽'

# 用戶頭像管理
@admin.register(UserHeadshot)
class UserHeadshotAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'img_url_preview', 'uploaded_at')
    search_fields = ('user__username', 'img_url')
    readonly_fields = ('uploaded_at',)
    
    def img_url_preview(self, obj):
        """顯示圖片URL的預覽"""
        max_length = 50
        if len(obj.img_url) > max_length:
            return f"{obj.img_url[:max_length]}..."
        return obj.img_url
    img_url_preview.short_description = '圖片URL預覽'
