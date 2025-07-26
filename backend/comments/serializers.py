from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from .models import Comment
from media.models import Image
from accounts.serializers import UserBasicSerializer
from interactions.models import UserInteraction

User = get_user_model()

class ImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Image
        fields = ['id', 'img_url', 'url', 'alt_text', 'sort_order', 'created_at']

class CommentReplySerializer(serializers.ModelSerializer):
    user = UserBasicSerializer(read_only=True)
    images = serializers.SerializerMethodField()
    
    class Meta:
        model = Comment
        fields = [
            'id', 'user', 'content', 'post_date', 'popularity', 
            'parent', 'images'
        ]
    
    def get_images(self, obj):
        """獲取評論關聯的圖片"""
        # 如果是已刪除評論，不返回圖片
        if obj.content == "[此評論已刪除]":
            return []
            
        comment_type = ContentType.objects.get_for_model(Comment)
        images = Image.objects.filter(
            content_type=comment_type,
            object_id=obj.id
        ).order_by('sort_order')
        return ImageSerializer(images, many=True).data

class CommentSerializer(serializers.ModelSerializer):
    user = UserBasicSerializer(read_only=True)
    images = serializers.SerializerMethodField()
    
    class Meta:
        model = Comment
        fields = [
            'id', 'user', 'content', 'post_date', 'popularity', 
            'parent', 'images'
        ]
        read_only_fields = ['id', 'post_date', 'popularity']
    
    def get_images(self, obj):
        """獲取評論關聯的圖片"""
        # 如果是已刪除評論，不返回圖片
        if obj.content == "[此評論已刪除]":
            return []
            
        comment_type = ContentType.objects.get_for_model(Comment)
        images = Image.objects.filter(
            content_type=comment_type,
            object_id=obj.id
        ).order_by('sort_order')
        return ImageSerializer(images, many=True).data
