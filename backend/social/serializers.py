from rest_framework import serializers
from media.models import Image, UserHeadshot
from .models import PostFrame, PostHashtag, SoLContent, PostPets
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from pets.models import Pet
from social.models import ImageAnnotation
from interactions.models import UserInteraction
from accounts.serializers import UserBasicSerializer
from accounts.models import CustomUser
from comments.models import Comment
from comments.serializers import CommentSerializer

User = get_user_model()

# === PostFrame 序列化器 ===
class PostFrameSerializer(serializers.ModelSerializer):
    """
    PostFrame 完整序列化器，包含所有相關資訊
    """
    user_info = serializers.SerializerMethodField()
    content = serializers.SerializerMethodField()
    hashtags = serializers.SerializerMethodField()
    tagged_pets = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    interaction_stats = serializers.SerializerMethodField()
    user_interaction = serializers.SerializerMethodField()
    annotations = serializers.SerializerMethodField()
    top_comments = serializers.SerializerMethodField()

    class Meta:
        model = PostFrame
        fields = [
            'id',
            'created_at',
            'updated_at',
            'user_info',
            'content',
            'hashtags',
            'tagged_pets',
            'images',
            'interaction_stats',
            'user_interaction',
            'annotations',
            'top_comments',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_user_info(self, postFrame: PostFrame):
        user = postFrame.getUser()
        headshot_url = None
        try:
            if hasattr(user, 'headshot') and user.headshot:
                headshot_url = user.headshot.firebase_url
        except:
            headshot_url = None
            
        return {
            'id': user.id,
            'username': user.username,
            'user_account': getattr(user, 'user_account', ''),
            'user_fullname': getattr(user, 'user_fullname', ''),
            'headshot_url': headshot_url
        }
    
    def get_content(self, postFrame: PostFrame):
        """獲取貼文內容"""
        try:
            content = SoLContent.objects.filter(postFrame=postFrame).first()
            if content:
                return {
                    'content_text': content.content_text,
                    'location': content.location
                }
            return {'content_text': '', 'location': None}
        except:
            return {'content_text': '', 'location': None}
    
    def get_hashtags(self, postFrame: PostFrame):
        hashtags = PostHashtag.objects.filter(postFrame=postFrame)
        hashtag_data = [{'id': hashtag.id, 'tag': hashtag.tag} for hashtag in hashtags]
        
        # 添加調試日誌
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"序列化器返回的標籤資料: {hashtag_data}")
        
        return hashtag_data

    def get_tagged_pets(self, postFrame: PostFrame):
        pets_relations = PostPets.objects.filter(postFrame=postFrame).select_related('pet')
        pets_data = []
        for relation in pets_relations:
            pet = relation.pet
            headshot_url = None
            if hasattr(pet, 'headshot') and pet.headshot:
                headshot_url = pet.headshot.url
            
            pets_data.append({
                'id': pet.id,
                'pet_name': pet.pet_name,
                'pet_type': getattr(pet, 'pet_type', 'unknown'),
                'headshot_url': headshot_url
            })
        return pets_data
    
    def get_images(self, postFrame: PostFrame):
        """獲取貼文的所有圖片"""
        try:
            from utils.image_service import ImageService
            images = ImageService.get_post_images(postFrame.id, use_cache=True)
            return [
                {
                    'id': image.id,
                    'firebase_url': image.firebase_url,
                    'firebase_path': image.firebase_path,
                    'url': image.url,  # 使用模型的 url property
                    'alt_text': image.alt_text,
                    'sort_order': image.sort_order
                }
                for image in images
            ]
        except:
            return []
    
    def get_interaction_stats(self, postFrame: PostFrame):
        from comments.models import Comment
        stats = postFrame.get_interaction_stats()
        # 動態計算留言總數（包含回覆）
        comment_count = Comment.objects.filter(postFrame=postFrame).count()
        return {
            'upvotes': stats[0],
            'downvotes': stats[1],
            'saves': stats[2],
            'shares': stats[3],
            'likes': stats[4],
            'comments': comment_count,
            'total_score': stats[0] - stats[1]
        }

    def get_user_interaction(self, postFrame: PostFrame):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return {
                'is_liked': False,
                'is_upvoted': False,
                'is_downvoted': False,
                'is_saved': False,
                'is_shared': False
            }

        user = CustomUser.objects.filter(username=request.user.username).first()
        if not user:
            return {
                'is_liked': False,
                'is_upvoted': False,
                'is_downvoted': False,
                'is_saved': False,
                'is_shared': False
            }

        records = UserInteraction.objects.filter(user=user, interactables=postFrame)

        return {
            'is_liked': records.filter(relation='liked').exists(),
            'is_upvoted': records.filter(relation='upvoted').exists(),
            'is_downvoted': records.filter(relation='downvoted').exists(),
            'is_saved': records.filter(relation='saved').exists(),
            'is_shared': records.filter(relation='shared').exists()
        }
    
    def get_annotations(self, postFrame: PostFrame):
        """獲取貼文圖片的標註"""
        try:
            images = Image.objects.filter(postFrame=postFrame)
            image_urls = [img.firebase_url for img in images if img.firebase_url]
            
            annotations = ImageAnnotation.objects.filter(
                firebase_url__in=image_urls
            ).order_by('created_at')
            
            return [
                {
                    'id': annotation.id,
                    'firebase_url': annotation.firebase_url,
                    'x_position': annotation.x_position,
                    'y_position': annotation.y_position,
                    'display_name': annotation.dynamic_name,
                    'target_type': annotation.target_type,
                    'target_id': annotation.target_id,
                    'created_by': {
                        'id': annotation.created_by.id,
                        'username': annotation.created_by.username,
                        'user_account': annotation.created_by.user_account
                    }
                }
                for annotation in annotations
            ]
        except:
            return []
        
    def get_top_comments(self, postFrame: PostFrame):
        comments = Comment.get_comments(postFrame)[:2]

        serializers = CommentSerializer(comments, many=True, context=self.context)

        return serializers.data

# === SoLContent 序列化器 (簡化版，用於特定場景) ===
class SolPostSerializer(serializers.ModelSerializer):
    """
    SoLContent 序列化器 - 專注於內容的輕量級版本
    """
    user_info = serializers.SerializerMethodField()
    hashtags = serializers.SerializerMethodField()
    tagged_pets = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    interaction_stats = serializers.SerializerMethodField()
    user_interaction = serializers.SerializerMethodField()
    post_id = serializers.SerializerMethodField()
    created_at = serializers.SerializerMethodField()
    annotations = serializers.SerializerMethodField()

    class Meta:
        model = SoLContent
        fields = [
            'post_id',
            'content_text',
            'location',
            'created_at',
            'user_info',
            'hashtags',
            'tagged_pets',
            'images',
            'interaction_stats',
            'user_interaction',
            'annotations'
        ]
    
    def get_post_id(self, solContent: SoLContent):
        return solContent.get_postFrame().id
    
    def get_created_at(self, solContent: SoLContent):
        return solContent.get_postFrame().created_at

    def get_user_info(self, solContent: SoLContent):
        user = solContent.get_postFrame().getUser()
        headshot_url = None
        try:
            if hasattr(user, 'headshot') and user.headshot:
                headshot_url = user.headshot.firebase_url
        except:
            headshot_url = None
            
        return {
            'id': user.id,
            'username': user.username,
            'user_account': getattr(user, 'user_account', ''),
            'user_fullname': getattr(user, 'user_fullname', ''),
            'headshot_url': headshot_url
        }
    
    def get_hashtags(self, solContent: SoLContent):
        hashtags = PostHashtag.objects.filter(postFrame=solContent.postFrame)
        return [{'id': hashtag.id, 'tag': hashtag.tag} for hashtag in hashtags]

    def get_tagged_pets(self, solContent: SoLContent):
        pets_relations = PostPets.objects.filter(postFrame=solContent.postFrame).select_related('pet')
        pets_data = []
        for relation in pets_relations:
            pet = relation.pet
            headshot_url = None
            if hasattr(pet, 'headshot') and pet.headshot:
                headshot_url = pet.headshot.url
            
            pets_data.append({
                'id': pet.id,
                'pet_name': pet.pet_name,
                'pet_type': getattr(pet, 'pet_type', 'unknown'),
                'headshot_url': headshot_url
            })
        return pets_data
    
    def get_images(self, solContent: SoLContent):
        """獲取貼文的所有圖片"""
        try:
            from utils.image_service import ImageService
            images = ImageService.get_post_images(solContent.postFrame.id, use_cache=True)
            return [
                {
                    'id': image.id,
                    'firebase_url': image.firebase_url,
                    'firebase_path': image.firebase_path,
                    'url': image.url,
                    'alt_text': image.alt_text,
                    'sort_order': image.sort_order
                }
                for image in images
            ]
        except:
            return []
    
    def get_interaction_stats(self, solContent: SoLContent):
        from comments.models import Comment
        postFrame = solContent.get_postFrame()
        stats = postFrame.get_interaction_stats()
        # 動態計算留言總數（包含回覆）
        comment_count = Comment.objects.filter(postFrame=postFrame).count()
        return {
            'upvotes': stats[0],
            'downvotes': stats[1],
            'saves': stats[2],
            'shares': stats[3],
            'likes': stats[4],
            'comments': comment_count,
            'total_score': stats[0] - stats[1]
        }

    def get_user_interaction(self, solContent: SoLContent):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return {
                'is_liked': False,
                'is_upvoted': False,
                'is_downvoted': False,
                'is_saved': False,
                'is_shared': False
            }

        user = CustomUser.objects.filter(username=request.user.username).first()
        if not user:
            return {
                'is_liked': False,
                'is_upvoted': False,
                'is_downvoted': False,
                'is_saved': False,
                'is_shared': False
            }

        records = UserInteraction.objects.filter(user=user, interactables=solContent.postFrame)

        return {
            'is_liked': records.filter(relation='liked').exists(),
            'is_upvoted': records.filter(relation='upvoted').exists(),
            'is_downvoted': records.filter(relation='downvoted').exists(),
            'is_saved': records.filter(relation='saved').exists(),
            'is_shared': records.filter(relation='shared').exists()
        }
    
    def get_annotations(self, solContent: SoLContent):
        """獲取貼文圖片的標註"""
        try:
            from media.models import Image
            images = Image.objects.filter(postFrame=solContent.postFrame)
            image_urls = [img.firebase_url for img in images if img.firebase_url]
            
            annotations = ImageAnnotation.objects.filter(
                firebase_url__in=image_urls
            ).order_by('created_at')
            
            return [
                {
                    'id': annotation.id,
                    'firebase_url': annotation.firebase_url,
                    'x_position': annotation.x_position,
                    'y_position': annotation.y_position,
                    'display_name': annotation.dynamic_name,
                    'target_type': annotation.target_type,
                    'target_id': annotation.target_id,
                    'created_by': {
                        'id': annotation.created_by.id,
                        'username': annotation.created_by.username,
                        'user_account': annotation.created_by.user_account
                    }
                }
                for annotation in annotations
            ]
        except:
            return []

# === 搜尋結果用戶序列化器 ===
class UserSearchSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'user_account']

# === 使用者詳細搜尋結果序列化器 ===
class UserDetailSearchSerializer(serializers.ModelSerializer):
    headshot_url = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'user_account', 'username', 'user_fullname', 'headshot_url', 'account_privacy']
    
    def get_headshot_url(self, user: User):
        try:
            if hasattr(user, 'headshot') and user.headshot:
                return user.headshot.firebase_url
        except:
            pass
        return None
        
# === 預覽用 PostFrame 序列化器 ===
class PostPreviewSerializer(serializers.ModelSerializer):
    first_image_url = serializers.SerializerMethodField()
    content_preview = serializers.SerializerMethodField()
    user_info = serializers.SerializerMethodField()
    interaction_stats = serializers.SerializerMethodField()
    user_interaction = serializers.SerializerMethodField()

    class Meta:
        model = PostFrame
        fields = ['id', 'created_at', 'first_image_url', 'content_preview', 'user_info', 'interaction_stats', 'user_interaction']

    def get_first_image_url(self, postFrame: PostFrame):
        """獲取第一張圖片URL"""
        try:
            from utils.image_service import ImageService
            return ImageService.get_post_first_image_url(postFrame.id, use_cache=True)
        except:
            return None
    
    def get_content_preview(self, postFrame: PostFrame):
        """獲取內容預覽（前100字）"""
        try:
            content = SoLContent.objects.filter(postFrame=postFrame).first()
            if content:
                text = content.content_text
                return text[:100] + '...' if len(text) > 100 else text
        except:
            pass
        return ""
    
    def get_user_info(self, postFrame: PostFrame):
        """獲取用戶基本資訊"""
        user = postFrame.getUser()
        return {
            'id': user.id,
            'username': user.username,
            'user_account': getattr(user, 'user_account', ''),
        }
    
    def get_interaction_stats(self, postFrame: PostFrame):
        """獲取互動統計"""
        from comments.models import Comment
        stats = postFrame.get_interaction_stats()
        # 動態計算留言總數（包含回覆）
        comment_count = Comment.objects.filter(postFrame=postFrame).count()
        return {
            'upvotes': stats[0],
            'downvotes': stats[1],
            'saves': stats[2],
            'shares': stats[3],
            'likes': stats[4],
            'comments': comment_count,
            'total_score': stats[0] - stats[1]
        }
    
    def get_user_interaction(self, postFrame: PostFrame):
        """獲取用戶互動狀態"""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return {
                'is_liked': False,
                'is_upvoted': False,
                'is_downvoted': False,
                'is_saved': False,
                'is_shared': False
            }

        user = CustomUser.objects.filter(username=request.user.username).first()
        if not user:
            return {
                'is_liked': False,
                'is_upvoted': False,
                'is_downvoted': False,
                'is_saved': False,
                'is_shared': False
            }

        records = UserInteraction.objects.filter(user=user, interactables=postFrame)

        return {
            'is_liked': records.filter(relation='liked').exists(),
            'is_upvoted': records.filter(relation='upvoted').exists(),
            'is_downvoted': records.filter(relation='downvoted').exists(),
            'is_saved': records.filter(relation='saved').exists(),
            'is_shared': records.filter(relation='shared').exists()
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
            if hasattr(obj, 'headshot') and obj.headshot:
                return obj.headshot.url
        except Exception:
            pass
        return None

# === 圖片標註序列化器 ===
class ImageAnnotationSerializer(serializers.ModelSerializer):
    created_by_info = serializers.SerializerMethodField()
    target_info = serializers.SerializerMethodField()
    dynamic_name = serializers.ReadOnlyField()
    
    class Meta:
        model = ImageAnnotation
        fields = [
            'id', 'firebase_url', 'x_position', 'y_position',
            'dynamic_name', 'target_type', 'target_id',
            'created_by', 'created_by_info', 'target_info',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'dynamic_name', 'created_at', 'updated_at']
    
    def get_created_by_info(self, annotation):
        """獲取創建者基本資訊"""
        user = annotation.created_by
        headshot_url = None
        try:
            if hasattr(user, 'headshot') and user.headshot:
                headshot_url = user.headshot.firebase_url
        except:
            pass
            
        return {
            'id': user.id,
            'username': user.username,
            'user_account': user.user_account,
            'headshot_url': headshot_url
        }
    
    def get_target_info(self, annotation):
        """獲取被標註目標的基本資訊"""
        target = annotation.get_target_object()
        if not target:
            return None
            
        if annotation.target_type == 'user':
            headshot_url = None
            try:
                if hasattr(target, 'headshot') and target.headshot:
                    headshot_url = target.headshot.firebase_url
            except:
                pass
                
            return {
                'id': target.id,
                'username': target.username,
                'user_account': target.user_account,
                'user_fullname': target.user_fullname,
                'headshot_url': headshot_url
            }
        elif annotation.target_type == 'pet':
            headshot_url = None
            try:
                if hasattr(target, 'headshot') and target.headshot:
                    headshot_url = target.headshot.url
            except:
                pass
                
            return {
                'id': target.id,
                'pet_name': target.pet_name,
                'pet_type': getattr(target, 'pet_type', 'unknown'),
                'headshot_url': headshot_url
            }
        
        return None