from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from .models import Comment
from media.models import CommentImage
from accounts.serializers import UserBasicSerializer
from interactions.models import UserInteraction

User = get_user_model()

class CommentImageSerializer(serializers.ModelSerializer):
    img_url = serializers.CharField(source='firebase_url', read_only=True)
    url = serializers.CharField(source='firebase_url', read_only=True)
    created_at = serializers.DateTimeField(source='uploaded_at', read_only=True)
    
    class Meta:
        model = CommentImage
        fields = ['id', 'img_url', 'url', 'alt_text', 'sort_order', 'created_at']

class CommentReplySerializer(serializers.ModelSerializer):
    user = UserBasicSerializer(read_only=True)
    images = serializers.SerializerMethodField()
    isAuthor = serializers.SerializerMethodField()
    isLiked = serializers.SerializerMethodField()
    likes = serializers.SerializerMethodField()
    
    class Meta:
        model = Comment
        fields = [
            'id', 'user', 'content', 'created_at', 'popularity', 
            'parent', 'images', 'isAuthor', 'isLiked', 'likes'
        ]
    
    def get_images(self, obj):
        """獲取評論關聯的圖片"""
        # 如果是已刪除評論，不返回圖片
        if obj.content == "[此評論已刪除]":
            return []
            
        comment_type = ContentType.objects.get_for_model(Comment)
        images = CommentImage.objects.filter(
            content_type=comment_type,
            object_id=obj.id
        ).order_by('sort_order')
        return CommentImageSerializer(images, many=True).data
    
    def get_isAuthor(self, obj):
        """檢查當前用戶是否為評論作者"""
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            return obj.user == request.user
        return False
    
    def get_isLiked(self, obj):
        """檢查當前用戶是否點讚了此評論"""
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            user = request.user
            interaction = UserInteraction.get_user_interactions(
                user=user,
                relation='liked',
                interactables=obj
            )
            return interaction is not None
        return False
    
    def get_likes(self, obj):
        """獲取評論總按讚數"""
        return UserInteraction.objects.filter(
            interactables=obj,
            relation='liked'
        ).count()

class CommentSerializer(serializers.ModelSerializer):
    user = UserBasicSerializer(read_only=True)
    images = serializers.SerializerMethodField()
    isAuthor = serializers.SerializerMethodField()
    isLiked = serializers.SerializerMethodField()
    likes = serializers.SerializerMethodField()
    
    class Meta:
        model = Comment
        fields = [
            'id', 'user', 'content', 'created_at', 'popularity', 
            'parent', 'images', 'isAuthor', 'isLiked', 'likes'
        ]
        read_only_fields = ['id', 'created_at', 'popularity']

    def get_images(self, obj):
        """獲取評論關聯的圖片"""
        # 如果是已刪除評論，不返回圖片
        if obj.content == "[此評論已刪除]":
            return []
            
        comment_type = ContentType.objects.get_for_model(Comment)
        images = CommentImage.objects.filter(
            content_type=comment_type,
            object_id=obj.id
        ).order_by('sort_order')
        return CommentImageSerializer(images, many=True).data
    
    def get_isLiked(self, obj):
        """檢查當前用戶是否點讚了此評論"""
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            user = request.user
            interaction = UserInteraction.get_user_interactions(
                user=user,
                relation='liked',
                interactables=obj
            )
            return interaction is not None
        return False
    
    def get_isAuthor(self, obj):
        """檢查當前用戶是否為評論作者"""
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            return obj.user == request.user
        return False
    
    def get_likes(self, obj):
        """獲取評論總按讚數"""
        return UserInteraction.objects.filter(
            interactables=obj,
            relation='liked'
        ).count()