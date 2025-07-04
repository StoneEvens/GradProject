from rest_framework import serializers
from media.models import Image, UserHeadshot
from .models import PostFrame, PostHashtag, SoLContent, PostPets
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from pets.models import Pet
from interactions.models import UserInteraction
from accounts.serializers import UserBasicSerializer
from accounts.models import CustomUser

User = get_user_model()

class SolPostSerializer(serializers.ModelSerializer):
    user_info = serializers.SerializerMethodField()
    hashtags = serializers.SerializerMethodField()
    tagged_pets = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    interaction_stats = serializers.SerializerMethodField()
    user_interaction = serializers.SerializerMethodField()

    class Meta:
        model = SoLContent
        fields = [
            'content_text',
            'user_info',
            'hashtags',
            'tagged_pets',
            'images',
            'interaction_stats',
            'user_interaction'
        ]
    
    def get_user_info(self, solContent: SoLContent):
        postFrame = solContent.postFrame
        return {
            'username': postFrame.getUser().username,
            'user_account': getattr(postFrame.getUser(), 'user_account', '')
        }
    
    def get_hashtags(self, solContent: SoLContent):
        postFrame = solContent.postFrame
        hashtags = PostHashtag.get_hashtags(postFrame=postFrame)

        return [{'hashtag': hashtag.tag} for hashtag in hashtags]

    def get_tagged_pets(self, solContent:SoLContent):
        postFrame = solContent.postFrame
        pets = PostPets.get_pets(postFrame)

        return [
            {'pet_name': pet.pet_name} for pet in pets
        ]
    
    def get_images(self, obj):
        """獲取貼文的所有圖片"""
        #images = Image.objects.filter(content_type__model='post', object_id=obj.id).order_by('sort_order')
        
        #return [
        #    {
        #        'id': image.id,
        #        'url': image.url if hasattr(image, 'url') else (
        #            image.img_url.url if hasattr(image.img_url, 'url') else image.img_url
        #        ),
        #        'alt_text': image.alt_text,
        #        'sort_order': image.sort_order
        #    }
        #    for image in images
        #]
    
    def get_interaction_stats(self, solContent:SoLContent):
        postFrame = solContent.postFrame
        status = postFrame.get_interaction_stats()
        return {
            'upvotes': status[0],
            'downvotes': status[1],
            'saves': status[2],
            'shares': status[3],
            'total_score': status[0] - status[1]
        }

    def get_user_interaction(self, solContent:SoLContent):
        postFrame = solContent.postFrame

        request = self.context.get('request')
        userID = request.user
        user = CustomUser.get_user(userID)

        records = UserInteraction.check_user_interaction(user=user, postFrame=postFrame)

        return {
            'is_upvoted': records.filter(relation='upvoted').exists(),
            'is_downvoted': records.filter(relation='downvoted').exists(),
            'is_saved': records.filter(relation='saved').exists(),
            'is_shared': records.filter(relation='shared').exists()
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
        fields = ['id', 'user_account', 'username', 'headshot', 'account_privacy']
    
    def get_headshot(self, user: User):
        try:
            image = UserHeadshot.get_headshot_url(user)

            return {
                'headshot': image.firebase_url
            }
        except:
            return None
        
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