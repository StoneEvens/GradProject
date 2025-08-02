from rest_framework import serializers
from feeds.models import Feed, UserFeed, FeedReview, FeedErrorReport, UserFeedMark
from media.models import FeedImage

class FeedSerializer(serializers.ModelSerializer):
    # 保留原有的 URL 欄位以維持向後相容性
    front_image_url = serializers.SerializerMethodField()
    nutrition_image_url = serializers.SerializerMethodField()
    # 新增創建者相關欄位
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    created_by_id = serializers.IntegerField(source='created_by.id', read_only=True)
    
    class Meta:
        model = Feed
        fields = [
            "id",
            "name",
            "brand",
            "pet_type",
            "protein",
            "fat",
            "carbohydrate",
            "calcium",
            "phosphorus",
            "magnesium",
            "sodium",
            "price",
            "review_count",
            "is_verified",
            "front_image_url",
            "nutrition_image_url",
            "created_by",
            "created_by_id",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
    
    def get_front_image_url(self, obj):
        """獲取正面圖片 URL"""
        front_image = obj.feed_images.filter(image_type='front').first()
        return front_image.firebase_url if front_image else None
    
    def get_nutrition_image_url(self, obj):
        """獲取營養標籤圖片 URL"""
        nutrition_image = obj.feed_images.filter(image_type='nutrition').first()
        return nutrition_image.firebase_url if nutrition_image else None

class UserFeedSerializer(serializers.ModelSerializer):
    feed = FeedSerializer(read_only=True)
    pet_name = serializers.CharField(source='pet.pet_name', read_only=True)
    pet_id = serializers.IntegerField(source='pet.id', read_only=True)
    
    class Meta:
        model = UserFeed
        fields = [
            "id",
            "feed",
            "pet_id",
            "pet_name",
            "usage_count",
            "last_used_at",
            "created_at",
            "updated_at",
        ]


class FeedReviewSerializer(serializers.ModelSerializer):
    reviewer_name = serializers.CharField(source='reviewer.username', read_only=True)
    
    class Meta:
        model = FeedReview
        fields = [
            "id",
            "feed",
            "reviewer",
            "reviewer_name",
            "reviewed_at",
        ]
        read_only_fields = ['reviewer', 'reviewed_at']


class FeedErrorReportSerializer(serializers.ModelSerializer):
    reporter_name = serializers.CharField(source='reporter.username', read_only=True)
    error_type_display = serializers.CharField(source='get_error_type_display', read_only=True)
    feed_name = serializers.CharField(source='feed.name', read_only=True)
    feed_brand = serializers.CharField(source='feed.brand', read_only=True)
    
    class Meta:
        model = FeedErrorReport
        fields = [
            "id",
            "feed",
            "feed_name",
            "feed_brand",
            "reporter",
            "reporter_name",
            "error_type",
            "error_type_display",
            "description",
            "original_data",
            "corrected_data",
            "is_resolved",
            "reported_at",
            "resolved_at",
        ]
        read_only_fields = ['reporter', 'reported_at', 'resolved_at']


class UserFeedMarkSerializer(serializers.ModelSerializer):
    feed = FeedSerializer(read_only=True)
    feed_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = UserFeedMark
        fields = [
            "id",
            "user",
            "feed",
            "feed_id",
            "created_at",
        ]
        read_only_fields = ['user', 'created_at']
