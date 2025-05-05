from rest_framework import serializers
from .models import Feed, UserFeed, PetFeed
from utils.file_safety import validate_image_content, MAX_FILE_SIZE, SAFE_IMAGE_MIMETYPES
from django.core.validators import MinValueValidator, MaxValueValidator
import re

# === 飼料基本信息序列化器 ===
class FeedSerializer(serializers.ModelSerializer):
    """
    飼料數據序列化器，用於展示飼料詳細信息
    """
    class Meta:
        model = Feed
        exclude = ['extracted_text', 'processing_error']
        read_only_fields = ['processing_status', 'created_at', 'updated_at']

# === 飼料處理狀態序列化器 ===
class FeedStatusSerializer(serializers.ModelSerializer):
    """
    飼料處理狀態序列化器，用於查詢處理狀態
    """
    class Meta:
        model = Feed
        fields = ['id', 'name', 'processing_status', 'processing_error']
        read_only_fields = fields

# === 飼料營養計算請求序列化器 ===
class NutritionCalculatorRequestSerializer(serializers.Serializer):
    """
    飼料營養計算請求參數驗證序列化器
    """
    feed_id = serializers.IntegerField(required=True)
    pet_info = serializers.DictField(required=True)
    
    def validate_pet_info(self, value):
        """驗證寵物信息的完整性和格式"""
        required_fields = ['pet_type', 'weight', 'pet_stage']
        for field in required_fields:
            if field not in value:
                raise serializers.ValidationError(f"缺少必要參數: {field}")
        
        # 驗證寵物類型
        if value['pet_type'] not in ['dog', 'cat']:
            raise serializers.ValidationError("寵物類型必須為 'dog' 或 'cat'")
        
        # 驗證體重
        try:
            weight = float(value['weight'])
            if weight <= 0:
                raise serializers.ValidationError("體重必須為正數")
            if weight > 100:  # 假設最大體重限制
                raise serializers.ValidationError("體重超出合理範圍")
        except (ValueError, TypeError):
            raise serializers.ValidationError("體重必須為有效數字")
        
        # 驗證寵物階段
        valid_stages = ['adult', 'pregnant', 'lactating', 'puppy', 'kitten']
        if value['pet_stage'] not in valid_stages:
            raise serializers.ValidationError(f"寵物階段必須為以下之一: {', '.join(valid_stages)}")
        
        return value

# === 使用者飼料使用紀錄序列化器 ===
class UserFeedSerializer(serializers.ModelSerializer):
    """
    用戶飼料使用記錄序列化器
    """
    class Meta:
        model = UserFeed
        fields = '__all__'

# === 寵物飼料使用紀錄序列化器 ===
class PetFeedSerializer(serializers.ModelSerializer):
    """
    寵物飼料使用記錄序列化器
    """
    feed_details = serializers.SerializerMethodField()
    
    class Meta:
        model = PetFeed
        fields = ['id', 'pet', 'feed', 'feed_details', 'last_used', 'is_current', 'notes']
        read_only_fields = ['last_used']
    
    def get_feed_details(self, obj):
        """獲取飼料的詳細資訊"""
        return {
            'id': obj.feed.id,
            'feed_name': obj.feed.feed_name,
            'protein': obj.feed.protein,
            'fat': obj.feed.fat,
            'calcium': obj.feed.calcium,
            'phosphorus': obj.feed.phosphorus
        }

# === 寵物飼料建立序列化器 ===
class PetFeedCreateSerializer(serializers.ModelSerializer):
    """
    用於建立寵物飼料關聯的序列化器
    """
    class Meta:
        model = PetFeed
        fields = ['pet', 'feed', 'is_current', 'notes']
    
    def validate(self, data):
        """驗證寵物和飼料關聯"""
        pet = data.get('pet')
        feed = data.get('feed')
        
        # 確認寵物屬於當前用戶
        request = self.context.get('request')
        if request and request.user and pet.owner != request.user:
            raise serializers.ValidationError({"pet": "您不是此寵物的主人"})
        
        return data
        
# === 飼料上傳序列化器 ===
class UploadFeedSerializer(serializers.Serializer):
    """
    飼料上傳請求參數驗證序列化器
    """
    name = serializers.CharField(max_length=100, required=True)
    front_image = serializers.ImageField(required=True)
    nutrition_image = serializers.ImageField(required=True)
    
    def validate_name(self, value):
        """驗證飼料名稱格式"""
        # 移除前後空格
        value = value.strip()
        if not value:
            raise serializers.ValidationError("飼料名稱不能為空")
        
        # 檢查名稱長度
        if len(value) < 2:
            raise serializers.ValidationError("飼料名稱太短")
        
        # 檢查是否包含特殊字符
        if re.search(r'[<>\'";%]', value):
            raise serializers.ValidationError("飼料名稱包含不允許的特殊字符")
            
        return value
    
    def validate_front_image(self, value):
        """驗證前方圖片的安全性"""
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
        """驗證營養成分圖片的安全性"""
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
