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
    interaction_stats = serializers.SerializerMethodField()
    is_upvoted = serializers.SerializerMethodField()
    is_downvoted = serializers.SerializerMethodField()
    is_deleted = serializers.SerializerMethodField()
    
    class Meta:
        model = Comment
        fields = [
            'id', 'user', 'content', 'post_date', 'popularity', 
            'parent', 'depth', 'mentioned_user', 'images',
            'interaction_stats', 'is_upvoted', 'is_downvoted',
            'is_deleted'
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
    
    def get_interaction_stats(self, obj):
        """獲取評論的互動統計"""
        comment_type = ContentType.objects.get_for_model(Comment)
        upvotes = UserInteraction.objects.filter(
            content_type=comment_type,
            object_id=obj.id,
            relation='upvoted'
        ).count()
        
        downvotes = UserInteraction.objects.filter(
            content_type=comment_type,
            object_id=obj.id,
            relation='downvoted'
        ).count()
        
        return {
            'upvotes': upvotes,
            'downvotes': downvotes,
            'total_score': upvotes - downvotes
        }
    
    def get_is_upvoted(self, obj):
        """檢查當前用戶是否對評論按讚"""
        user = self.context.get('request').user
        if not user.is_authenticated:
            return False
            
        comment_type = ContentType.objects.get_for_model(Comment)
        return UserInteraction.objects.filter(
            user=user,
            content_type=comment_type,
            object_id=obj.id,
            relation='upvoted'
        ).exists()
    
    def get_is_downvoted(self, obj):
        """檢查當前用戶是否對評論踩"""
        user = self.context.get('request').user
        if not user.is_authenticated:
            return False
            
        comment_type = ContentType.objects.get_for_model(Comment)
        return UserInteraction.objects.filter(
            user=user,
            content_type=comment_type,
            object_id=obj.id,
            relation='downvoted'
        ).exists()
    
    def get_is_deleted(self, obj):
        """檢查評論是否已被刪除"""
        return obj.content == "[此評論已刪除]"

class CommentSerializer(serializers.ModelSerializer):
    user = UserBasicSerializer(read_only=True)
    images = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()
    reply_count = serializers.SerializerMethodField()
    interaction_stats = serializers.SerializerMethodField()
    is_upvoted = serializers.SerializerMethodField()
    is_downvoted = serializers.SerializerMethodField()
    is_deleted = serializers.SerializerMethodField()
    
    class Meta:
        model = Comment
        fields = [
            'id', 'user', 'content', 'post_date', 'popularity', 
            'parent', 'depth', 'mentioned_user', 'images',
            'replies', 'reply_count', 'interaction_stats', 
            'is_upvoted', 'is_downvoted', 'is_deleted'
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
    
    def get_replies(self, obj):
        """獲取評論的第一層回覆（最多3條，按熱度排序）"""
        # 只獲取直接回覆（深度+1）
        replies = obj.replies.filter(depth=obj.depth+1).order_by('-popularity', '-post_date')[:3]
        return CommentReplySerializer(
            replies, 
            many=True, 
            context=self.context
        ).data
    
    def get_reply_count(self, obj):
        """獲取評論的總回覆數量"""
        return obj.replies.count()
    
    def get_interaction_stats(self, obj):
        """獲取評論的互動統計"""
        comment_type = ContentType.objects.get_for_model(Comment)
        upvotes = UserInteraction.objects.filter(
            content_type=comment_type,
            object_id=obj.id,
            relation='upvoted'
        ).count()
        
        downvotes = UserInteraction.objects.filter(
            content_type=comment_type,
            object_id=obj.id,
            relation='downvoted'
        ).count()
        
        return {
            'upvotes': upvotes,
            'downvotes': downvotes,
            'total_score': upvotes - downvotes
        }
    
    def get_is_upvoted(self, obj):
        """檢查當前用戶是否對評論按讚"""
        user = self.context.get('request').user
        if not user.is_authenticated:
            return False
            
        comment_type = ContentType.objects.get_for_model(Comment)
        return UserInteraction.objects.filter(
            user=user,
            content_type=comment_type,
            object_id=obj.id,
            relation='upvoted'
        ).exists()
    
    def get_is_downvoted(self, obj):
        """檢查當前用戶是否對評論踩"""
        user = self.context.get('request').user
        if not user.is_authenticated:
            return False
            
        comment_type = ContentType.objects.get_for_model(Comment)
        return UserInteraction.objects.filter(
            user=user,
            content_type=comment_type,
            object_id=obj.id,
            relation='downvoted'
        ).exists()
        
    def get_is_deleted(self, obj):
        """檢查評論是否已被刪除"""
        return obj.content == "[此評論已刪除]"
