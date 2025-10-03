"""
AI Agent Serializers
對話記錄序列化器
"""

from rest_framework import serializers
from .models import Conversation, Message, ConversationFeedback
from social.models import CustomUser


class MessageSerializer(serializers.ModelSerializer):
    """訊息序列化器"""

    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = Message
        fields = [
            'id',
            'conversation',
            'role',
            'role_display',
            'content',
            'created_at',
            'intent',
            'confidence',
            'source',
            'has_tutorial',
            'tutorial_type',
            'has_recommended_users',
            'has_recommended_articles',
            'has_calculator',
            'has_operation',
            'operation_type',
            'additional_data',
            'entities',
        ]
        read_only_fields = ['id', 'created_at', 'role_display']


class MessageCreateSerializer(serializers.ModelSerializer):
    """訊息建立序列化器（簡化版）"""

    class Meta:
        model = Message
        fields = ['role', 'content']


class ConversationListSerializer(serializers.ModelSerializer):
    """對話列表序列化器（簡化版）"""

    user_account = serializers.CharField(source='user.user_account', read_only=True)
    last_message_preview = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            'id',
            'user_account',
            'title',
            'created_at',
            'updated_at',
            'last_message_at',
            'message_count',
            'is_pinned',
            'is_archived',
            'last_message_preview',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'last_message_at', 'message_count']

    def get_last_message_preview(self, obj):
        """取得最後一條訊息預覽"""
        last_message = obj.messages.order_by('-created_at').first()
        if last_message:
            content = last_message.content.strip()
            return content[:50] + '...' if len(content) > 50 else content
        return None


class ConversationDetailSerializer(serializers.ModelSerializer):
    """對話詳細資訊序列化器（包含所有訊息）"""

    user_account = serializers.CharField(source='user.user_account', read_only=True)
    messages = MessageSerializer(many=True, read_only=True)

    class Meta:
        model = Conversation
        fields = [
            'id',
            'user',
            'user_account',
            'title',
            'created_at',
            'updated_at',
            'last_message_at',
            'message_count',
            'is_pinned',
            'is_archived',
            'context_data',
            'messages',
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at', 'last_message_at', 'message_count']


class ConversationCreateSerializer(serializers.ModelSerializer):
    """對話建立序列化器"""

    class Meta:
        model = Conversation
        fields = ['title', 'context_data']

    def create(self, validated_data):
        """建立對話，自動關聯當前使用者"""
        user = self.context['request'].user
        validated_data['user'] = user
        return super().create(validated_data)


class ConversationUpdateSerializer(serializers.ModelSerializer):
    """對話更新序列化器"""

    class Meta:
        model = Conversation
        fields = ['title', 'is_pinned', 'is_archived', 'context_data']


class ConversationFeedbackSerializer(serializers.ModelSerializer):
    """對話回饋序列化器"""

    user_account = serializers.CharField(source='user.user_account', read_only=True)
    rating_display = serializers.CharField(source='get_rating_display', read_only=True)

    class Meta:
        model = ConversationFeedback
        fields = [
            'id',
            'message',
            'user',
            'user_account',
            'rating',
            'rating_display',
            'comment',
            'is_inaccurate',
            'is_unhelpful',
            'is_inappropriate',
            'is_other',
            'created_at',
        ]
        read_only_fields = ['id', 'user', 'user_account', 'created_at', 'rating_display']

    def create(self, validated_data):
        """建立回饋，自動關聯當前使用者"""
        user = self.context['request'].user
        validated_data['user'] = user
        return super().create(validated_data)