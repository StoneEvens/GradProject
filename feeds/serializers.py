from rest_framework import serializers
from .models import Feed, UserFeed
from utils.file_safety import validate_image_content, MAX_FILE_SIZE, SAFE_IMAGE_MIMETYPES

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
        """
        驗證前方圖片的安全性
        """
        # 檢查文件大小 (限制為 5MB)
        if value.size > MAX_FILE_SIZE:
            raise serializers.ValidationError(f"正面圖片大小不能超過 {MAX_FILE_SIZE/(1024*1024)}MB")
        
        # 檢查文件類型
        file_type = getattr(value, 'content_type', '')
        if file_type not in SAFE_IMAGE_MIMETYPES:
            raise serializers.ValidationError(f"正面圖片格式必須是 JPEG, PNG 或 WebP，當前類型: {file_type}")
        
        # 執行詳細的圖片內容安全檢查
        is_safe, error_message = validate_image_content(value)
        if not is_safe:
            raise serializers.ValidationError(f"正面圖片驗證失敗: {error_message}")
        
        return value
    
    def validate_nutrition_image(self, value):
        """
        驗證營養成分圖片的安全性
        """
        # 檢查文件大小 (限制為 5MB)
        if value.size > MAX_FILE_SIZE:
            raise serializers.ValidationError(f"營養成分圖片大小不能超過 {MAX_FILE_SIZE/(1024*1024)}MB")
        
        # 檢查文件類型
        file_type = getattr(value, 'content_type', '')
        if file_type not in SAFE_IMAGE_MIMETYPES:
            raise serializers.ValidationError(f"營養成分圖片格式必須是 JPEG, PNG 或 WebP，當前類型: {file_type}")
        
        # 執行詳細的圖片內容安全檢查
        is_safe, error_message = validate_image_content(value)
        if not is_safe:
            raise serializers.ValidationError(f"營養成分圖片驗證失敗: {error_message}")
        
        return value
