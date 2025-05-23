from rest_framework import serializers
from .models import Image, UserHeadshot, PetHeadshot


class ImageSerializer(serializers.ModelSerializer):
    """圖片序列化器"""
    
    class Meta:
        model = Image
        fields = [
            'id', 'content_type', 'object_id', 'img_url', 'public_id',
            'original_filename', 'file_size', 'content_type_mime',
            'sort_order', 'alt_text', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class UserHeadshotSerializer(serializers.ModelSerializer):
    """用戶頭像序列化器"""
    
    class Meta:
        model = UserHeadshot
        fields = ['id', 'user', 'img_url', 'public_id', 'uploaded_at']
        read_only_fields = ['id', 'user', 'uploaded_at']


class PetHeadshotSerializer(serializers.ModelSerializer):
    """寵物頭像序列化器"""
    
    class Meta:
        model = PetHeadshot
        fields = ['id', 'pet', 'img_url', 'public_id', 'uploaded_at']
        read_only_fields = ['id', 'pet', 'uploaded_at']


class ImageUploadSerializer(serializers.Serializer):
    """圖片上傳序列化器（暫時保留結構，未來實作時使用）"""
    image = serializers.ImageField()
    content_type_id = serializers.IntegerField()
    object_id = serializers.IntegerField()
    alt_text = serializers.CharField(max_length=255, required=False, allow_blank=True)
    sort_order = serializers.IntegerField(default=0)


class UserAvatarUploadSerializer(serializers.Serializer):
    """用戶頭像上傳序列化器（暫時保留結構，未來實作時使用）"""
    avatar = serializers.ImageField()


class PetPhotoUploadSerializer(serializers.Serializer):
    """寵物照片上傳序列化器（暫時保留結構，未來實作時使用）"""
    photo = serializers.ImageField()
    photo_type = serializers.ChoiceField(
        choices=['headshot', 'general'],
        default='headshot'
    )
