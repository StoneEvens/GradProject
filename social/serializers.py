from rest_framework import serializers
from media.models import Image
from .models import Post, PostHashtag
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from pets.models import Pet, PetGenericRelation
from interactions.models import UserInteraction

User = get_user_model()

# === 貼文序列化器 ===
class PostSerializer(serializers.ModelSerializer):
    user_info = serializers.SerializerMethodField()
    hashtags = serializers.SerializerMethodField()
    tagged_pets = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    interaction_stats = serializers.SerializerMethodField()
    user_interaction = serializers.SerializerMethodField()
    
    class Meta:
        model = Post
        fields = [
            'id', 'user', 'user_info', 'content', 'created_at', 
            'updated_at', 'popularity', 'hashtags', 'tagged_pets', 
            'images', 'interaction_stats', 'user_interaction'
        ]
        read_only_fields = ['user', 'created_at', 'updated_at', 'popularity']
    
    def get_user_info(self, obj):
        """獲取貼文作者的基本資訊"""
        return {
            'id': obj.user.id,
            'username': obj.user.username,
            'user_fullname': getattr(obj.user, 'user_fullname', ''),
            'user_account': getattr(obj.user, 'user_account', '')
        }
    
    def get_hashtags(self, obj):
        """獲取貼文的標籤"""
        hashtags = PostHashtag.objects.filter(post=obj)
        return [hashtag.tag for hashtag in hashtags]
    
    def get_tagged_pets(self, obj):
        """獲取被標記的寵物資訊"""
        post_content_type = ContentType.objects.get_for_model(Post)
        pet_relations = PetGenericRelation.objects.filter(
            content_type=post_content_type,
            object_id=obj.id
        ).select_related('pet')
        
        return [
            {
                'id': relation.pet.id,
                'pet_name': relation.pet.pet_name,
                'pet_type': relation.pet.pet_type,
                'breed': relation.pet.breed
            }
            for relation in pet_relations
        ]
    
    def get_images(self, obj):
        """獲取貼文的所有圖片"""
        images = Image.objects.filter(
            content_type__model='post',
            object_id=obj.id
        ).order_by('sort_order')
        
        return [
            {
                'id': image.id,
                'url': image.url if hasattr(image, 'url') else (
                    image.img_url.url if hasattr(image.img_url, 'url') else image.img_url
                ),
                'alt_text': image.alt_text,
                'sort_order': image.sort_order
            }
            for image in images
        ]
    
    def get_interaction_stats(self, obj):
        """獲取貼文的互動統計"""
        return obj.get_interaction_stats()
    
    def get_user_interaction(self, obj):
        """獲取當前用戶與貼文的互動狀態"""
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            user = request.user
            return {
                'is_upvoted': obj.check_user_interaction(user, 'upvoted'),
                'is_downvoted': obj.check_user_interaction(user, 'downvoted'),
                'is_saved': obj.check_user_interaction(user, 'saved'),
                'is_shared': obj.check_user_interaction(user, 'shared')
            }
        return {
            'is_upvoted': False,
            'is_downvoted': False,
            'is_saved': False,
            'is_shared': False
        }

# === 貼文 Hashtag 序列化器 ===
class PostHashtagSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostHashtag
        fields = '__all__'

#預覽用post
class PostPreviewSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    first_image_url = serializers.SerializerMethodField()

    def get_first_image_url(self, obj: Post):
        # 這個方法現在會在視圖的 list 方法中被覆蓋
        # 但我們保留它以防視圖以外的地方使用序列化器
        qs = Image.objects.filter(
            content_type__model='post',
            object_id=obj.id
        ).order_by('sort_order')
        if qs.exists():
            return qs.first().img_url
        return None

# === 搜尋結果用户序列化器 ===
class UserSearchSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'user_fullname', 'user_account']

# === 使用者詳細搜尋結果序列化器 ===
class UserDetailSearchSerializer(serializers.ModelSerializer):
    headshot = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'user_account', 'user_fullname', 'headshot']
    
    def get_headshot(self, obj):
        try:
            user_type = ContentType.objects.get_for_model(User)
            image = Image.objects.filter(
                content_type=user_type,
                object_id=obj.id
            ).first()
            
            if image and hasattr(image.img_url, 'url'):
                return image.img_url.url
            return None
        except:
            return None

# === 搜尋結果貼文序列化器 ===
class PostSearchSerializer(serializers.ModelSerializer):
    user = UserSearchSerializer(read_only=True)
    hashtags = serializers.SerializerMethodField()
    first_image_url = serializers.SerializerMethodField()
    interaction_stats = serializers.SerializerMethodField()
    user_interaction = serializers.SerializerMethodField()
    
    class Meta:
        model = Post
        fields = [
            'id', 'user', 'content', 'created_at', 'updated_at', 
            'popularity', 'hashtags', 'first_image_url', 
            'interaction_stats', 'user_interaction'
        ]
    
    def get_hashtags(self, obj):
        hashtags = PostHashtag.objects.filter(post=obj)
        return [hashtag.tag for hashtag in hashtags]
    
    def get_first_image_url(self, obj):
        qs = Image.objects.filter(
            content_type__model='post',
            object_id=obj.id
        ).order_by('sort_order')
        if qs.exists():
            return qs.first().img_url.url if hasattr(qs.first().img_url, 'url') else None
        return None
    
    def get_interaction_stats(self, obj):
        """獲取貼文的互動統計"""
        return obj.get_interaction_stats()
    
    def get_user_interaction(self, obj):
        """獲取當前用戶與貼文的互動狀態"""
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            user = request.user
            return {
                'is_upvoted': obj.check_user_interaction(user, 'upvoted'),
                'is_downvoted': obj.check_user_interaction(user, 'downvoted'),
                'is_saved': obj.check_user_interaction(user, 'saved'),
                'is_shared': obj.check_user_interaction(user, 'shared')
            }
        return {
            'is_upvoted': False,
            'is_downvoted': False,
            'is_saved': False,
            'is_shared': False
        }

# === 搜尋關鍵字建議序列化器 ===
class SearchSuggestionSerializer(serializers.Serializer):
    type = serializers.CharField()  # 'user' 或 'hashtag'
    value = serializers.CharField()  # 建議的關鍵字

# === 貼文標記寵物選擇序列化器 ===
class PostTagPetSerializer(serializers.ModelSerializer):
    headshot_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Pet
        fields = ['id', 'pet_name', 'pet_type', 'headshot_url']
    
    def get_headshot_url(self, obj):
        """獲取寵物頭像 URL"""
        try:
            if hasattr(obj, 'headshot'):
                headshot = obj.headshot
                if headshot and hasattr(headshot, 'url'):
                    return headshot.url
                elif headshot and hasattr(headshot.img_url, 'url'):
                    return headshot.img_url.url
                elif headshot:
                    return headshot.img_url
        except Exception:
            pass
        return None