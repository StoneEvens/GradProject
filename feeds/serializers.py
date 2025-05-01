from rest_framework import serializers
from .models import Feed, UserFeed

# === 飼料資訊序列化器 ===
class FeedSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feed
        fields = '__all__'

# === 使用者飼料使用紀錄序列化器 ===
class UserFeedSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserFeed
        fields = '__all__'
