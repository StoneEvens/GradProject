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

class UploadFeedSerializer(serializers.Serializer):
    feed_name = serializers.CharField(max_length=255, required=True)
    front_image = serializers.ImageField(required=True)
    nutrition_image = serializers.ImageField(required=True)
    
    def validate_feed_name(self, value):
        if len(value.strip()) == 0:
            raise serializers.ValidationError("飼料名稱不能為空")
        return value
    
    def validate_front_image(self, value):
        # 檢查文件大小 (限制為 5MB)
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("正面圖片大小不能超過 5MB")
        
        # 檢查文件類型
        allowed_types = ['image/jpeg', 'image/png', 'image/webp']
        file_type = getattr(value, 'content_type', '')
        if file_type not in allowed_types:
            raise serializers.ValidationError("正面圖片格式必須是 JPEG, PNG 或 WebP")
        
        return value
    
    def validate_nutrition_image(self, value):
        # 檢查文件大小 (限制為 5MB)
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("營養成分圖片大小不能超過 5MB")
        
        # 檢查文件類型
        allowed_types = ['image/jpeg', 'image/png', 'image/webp']
        file_type = getattr(value, 'content_type', '')
        if file_type not in allowed_types:
            raise serializers.ValidationError("營養成分圖片格式必須是 JPEG, PNG 或 WebP")
        
        return value
