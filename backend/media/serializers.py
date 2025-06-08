from rest_framework import serializers
from .models import Image, UserHeadshot, PetHeadshot


class ImageSerializer(serializers.ModelSerializer):
    """圖片序列化器 - Firebase Storage 版本"""
    url = serializers.ReadOnlyField()  # 使用模型的 url 屬性
    
    class Meta:
        model = Image
        fields = [
            'id', 'content_type', 'object_id', 'firebase_url', 'firebase_path',
            'original_filename', 'file_size', 'content_type_mime',
            'sort_order', 'alt_text', 'created_at', 'updated_at', 'url'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'url']


class UserHeadshotSerializer(serializers.ModelSerializer):
    """用戶頭像序列化器 - Firebase Storage 版本"""
    url = serializers.ReadOnlyField()  # 使用模型的 url 屬性
    
    class Meta:
        model = UserHeadshot
        fields = ['id', 'user', 'firebase_url', 'firebase_path', 'uploaded_at', 'url']
        read_only_fields = ['id', 'user', 'uploaded_at', 'url']


class PetHeadshotSerializer(serializers.ModelSerializer):
    """寵物頭像序列化器 - Firebase Storage 版本"""
    url = serializers.ReadOnlyField()  # 使用模型的 url 屬性
    
    class Meta:
        model = PetHeadshot
        fields = ['id', 'pet', 'firebase_url', 'firebase_path', 'uploaded_at', 'url']
        read_only_fields = ['id', 'pet', 'uploaded_at', 'url']


# === Firebase Storage 上傳相關序列化器 ===

class ImageUploadSerializer(serializers.Serializer):
    """圖片上傳序列化器 - Firebase Storage 版本"""
    image = serializers.ImageField(help_text="要上傳的圖片檔案")
    content_type_id = serializers.IntegerField(help_text="內容類型 ID")
    object_id = serializers.IntegerField(help_text="對象 ID")
    alt_text = serializers.CharField(max_length=255, required=False, allow_blank=True, help_text="替代文字")
    sort_order = serializers.IntegerField(default=0, help_text="排序順序")


class UserAvatarUploadSerializer(serializers.Serializer):
    """用戶頭像上傳序列化器 - Firebase Storage 版本"""
    avatar = serializers.ImageField(help_text="用戶頭像圖片檔案")


class PetPhotoUploadSerializer(serializers.Serializer):
    """寵物照片上傳序列化器 - Firebase Storage 版本"""
    photo = serializers.ImageField(help_text="寵物照片檔案")
    photo_type = serializers.ChoiceField(
        choices=['headshot', 'general'],
        default='headshot',
        help_text="照片類型：headshot（頭像）或 general（一般照片）"
    )
