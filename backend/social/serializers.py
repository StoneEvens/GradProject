from rest_framework import serializers
from media.models import Image, UserHeadshot
from .models import PostFrame, PostHashtag, SoLContent
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from pets.models import Pet, PetGenericRelation
from interactions.models import UserInteraction
from accounts.serializers import UserBasicSerializer

User = get_user_model()

# === 貼文序列化器 ===
class PostFrameSerializer(serializers.ModelSerializer):
    user_info = serializers.SerializerMethodField()
    hashtags = serializers.SerializerMethodField()
    tagged_pets = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    interaction_stats = serializers.SerializerMethodField()
    user_interaction = serializers.SerializerMethodField()
    content = serializers.SerializerMethodField()

    class Meta:
        model = PostFrame
        fields = [
            'id', 'user', 'created_at', 
            'updated_at', 'upvotes', 'downvotes',
            'saves', 'shares',
            'user_info', 'hashtags', 'tagged_pets', 'images', 'interaction_stats', 'user_interaction', 'content'
        ]
        read_only_fields = ['user', 'created_at', 'updated_at']
    
    def get_user_info(self, postFrame: PostFrame):
        return {
            'username': postFrame.getUser().username,
            'user_account': getattr(postFrame.getUser(), 'user_account', '')
        }

    def get_hashtags(self, postFrame: PostFrame):
        hashtags = PostHashtag.get_hashtags(postFrame)

        return [{'hashtag': hashtag.tag} for hashtag in hashtags]

    def get_tagged_pets(self, postFrame: PostFrame):
        post_content_type = ContentType.objects.get_for_model(PostFrame)
        pet_relations = PetGenericRelation.objects.filter(
            content_type=post_content_type,
            object_id=postFrame.id
        ).select_related('pet')
        
        return [
            {'pet_name': relation.pet.pet_name} for relation in pet_relations
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
    
    def get_interaction_stats(self, postFrame: PostFrame):
        status = postFrame.get_interaction_stats()
        return {
            'upvotes': status.get('upvotes', 0),
            'downvotes': status.get('downvotes', 0),
            'saves': status.get('saves', 0),
            'shares': status.get('shares', 0),
            'total_score': status.get('upvotes', 0) - status.get('downvotes', 0)
        }

    def get_user_interaction(self, postFrame: PostFrame):
        request = self.context.get('request')
        user = request.user
        postID = postFrame.id

        records = UserInteraction.get_user_interactions(user, postID)
        if not records.exists():
            return {
                'is_upvoted': False,
                'is_downvoted': False,
                'is_saved': False,
                'is_shared': False
            }

        return {
            'is_upvoted': records.filter(relation='upvoted').exists(),
            'is_downvoted': records.filter(relation='downvoted').exists(),
            'is_saved': records.filter(relation='saved').exists(),
            'is_shared': records.filter(relation='shared').exists()
        }
    
    def get_context(self, postFrame: PostFrame):
        request = self.context.get('request')
        user = request.user

        return SoLContent.get_content(postFrame, user)

#預覽用post
class PostPreviewSerializer(serializers.ModelSerializer):
    first_image_url = serializers.SerializerMethodField()
    content = serializers.SerializerMethodField()

    class Meta:
        model = PostFrame
        fields = ['content', 'created_at', 'first_image_url']

    def get_first_image_url(self, postFrame: PostFrame):
        try:
            return Image.get_first_image_url(postFrame)
        except Exception as e:
            pass
        return None
    
    def get_content(self, postFrame: PostFrame):
        request = self.context.get('request')
        user = request.user

        content = SoLContent.get_content(postFrame, user)

        return {
            'content': content.content
        }

# === 搜尋結果用户序列化器 ===
class UserSearchSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'user_account']

# === 使用者詳細搜尋結果序列化器 ===
class UserDetailSearchSerializer(serializers.ModelSerializer):
    headshot = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'user_account', 'username', 'headshot']
    
    def get_headshot(self, user: User):
        try:
            image = UserHeadshot.get_headshot_url(user)

            return {
                'headshot': image.firebase_url
            }
        except:
            return None

# === 搜尋結果貼文序列化器 ===
class PostSearchSerializer(serializers.ModelSerializer):
    user = UserSearchSerializer(read_only=True)
    hashtags = serializers.SerializerMethodField()
    first_image_url = serializers.SerializerMethodField()
    interaction_stats = serializers.SerializerMethodField()
    user_interaction = serializers.SerializerMethodField()
    content = serializers.SerializerMethodField()
    
    class Meta:
        model = PostFrame
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