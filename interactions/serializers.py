from rest_framework import serializers
from django.contrib.contenttypes.models import ContentType
from django.contrib.auth import get_user_model
from .models import UserInteraction

User = get_user_model()

class UserInteractionSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserInteraction
        fields = ['id', 'user', 'content_type', 'object_id', 'relation', 'created_at']
        read_only_fields = ['user', 'created_at']

class InteractionStatusSerializer(serializers.Serializer):
    """
    用於返回當前用戶對特定對象的互動狀態
    """
    is_upvoted = serializers.BooleanField(default=False)
    is_downvoted = serializers.BooleanField(default=False)
    is_saved = serializers.BooleanField(default=False)
    is_shared = serializers.BooleanField(default=False)
    upvote_count = serializers.IntegerField(default=0)
    downvote_count = serializers.IntegerField(default=0)
    save_count = serializers.IntegerField(default=0)
    share_count = serializers.IntegerField(default=0)
    
    @classmethod
    def get_interaction_status(cls, obj, user, context=None):
        """
        獲取物件的互動狀態
        obj：要檢查互動的對象
        user：當前用戶
        """
        if not obj:
            return cls().data
            
        obj_type = ContentType.objects.get_for_model(obj)
        
        # 默認結果
        result = {
            'is_upvoted': False,
            'is_downvoted': False,
            'is_saved': False,
            'is_shared': False,
            'upvote_count': 0,
            'downvote_count': 0,
            'save_count': 0,
            'share_count': 0
        }
        
        # 獲取互動統計
        result['upvote_count'] = UserInteraction.objects.filter(
            content_type=obj_type, object_id=obj.id, relation='upvoted'
        ).count()
        
        result['downvote_count'] = UserInteraction.objects.filter(
            content_type=obj_type, object_id=obj.id, relation='downvoted'
        ).count()
        
        result['save_count'] = UserInteraction.objects.filter(
            content_type=obj_type, object_id=obj.id, relation='saved'
        ).count()
        
        result['share_count'] = UserInteraction.objects.filter(
            content_type=obj_type, object_id=obj.id, relation='shared'
        ).count()
        
        # 如果用戶已登入，獲取用戶互動狀態
        if user and user.is_authenticated:
            # 獲取所有與該對象相關的用戶互動
            user_interactions = UserInteraction.objects.filter(
                content_type=obj_type,
                object_id=obj.id,
                user=user
            ).values_list('relation', flat=True)
            
            # 設置互動狀態
            result['is_upvoted'] = 'upvoted' in user_interactions
            result['is_downvoted'] = 'downvoted' in user_interactions
            result['is_saved'] = 'saved' in user_interactions
            result['is_shared'] = 'shared' in user_interactions
            
        return result
