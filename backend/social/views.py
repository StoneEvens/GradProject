from rest_framework import generics, status as drf_status
from rest_framework.parsers import MultiPartParser, FormParser
from .models import PostHashtag, PostFrame, SoLContent, PostPets, ImageAnnotation
from .serializers import *
from rest_framework.permissions import IsAuthenticated
from utils.api_response import APIResponse
from utils.query_optimization import log_queries
from utils.image_service import ImageService
from django.contrib.contenttypes.models import ContentType
from media.models import Image, PetHeadshot
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Q, QuerySet, Max
from django.contrib.auth import get_user_model
from pets.models import Pet
from accounts.models import CustomUser
from django.db import transaction
from django.utils.text import slugify
from django.utils import timezone
from django.apps import apps
from datetime import datetime
import json
import re
import logging
import random

User = get_user_model()
logger = logging.getLogger(__name__)

class DataHandler:
    """資料處理工具類"""
    
    @staticmethod
    def parse_hashtags(content: str, tags: str = None):
        """解析標籤"""
        logger.info(f"🏷️ 開始解析標籤 - content: '{content}', tags: '{tags}'")
        
        # 從內容中提取 hashtag（以 # 開頭的詞，支援中文）
        # 使用 [\w\u4e00-\u9fff]+ 來匹配英文字母、數字和中文字符
        implicit_tags = re.findall(r'#([\w\u4e00-\u9fff]+)', content)
        logger.info(f"從內容提取的標籤: {implicit_tags}")
        
        # 處理明確傳入的標籤
        explicit_tags = []
        if tags:
            logger.info(f"處理明確標籤字串: '{tags}'")
            # 移除每個標籤可能的 # 前綴
            tag_list = [tag.strip().lstrip('#') for tag in tags.split(',')]
            explicit_tags = [tag for tag in tag_list if tag]
            logger.info(f"處理後的明確標籤: {explicit_tags}")
        
        # 組合並去重標籤
        all_tags = list(set(implicit_tags + explicit_tags))
        final_tags = [tag.strip() for tag in all_tags if tag.strip()]
        
        logger.info(f"最終解析結果: {final_tags}")
        return final_tags
    
    @staticmethod
    def parse_pets(pet_ids: str = None):
        """解析寵物ID列表"""
        if not pet_ids:
            return []
            
        try:
            ids = [int(id.strip()) for id in pet_ids.split(',') if id.strip().isdigit()]
            pets = Pet.objects.filter(id__in=ids)
            return list(pets)
        except (ValueError, AttributeError):
            return []

#----------用戶貼文預覽 API----------
class UserPostsPreviewListAPIView(generics.ListAPIView):
    """獲取用戶的貼文預覽列表"""
    permission_classes = [IsAuthenticated]
    serializer_class = PostPreviewSerializer
    
    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return PostFrame.objects.none()
        user_id = self.kwargs['pk']
        if not user_id:  # 沒有 pk 就直接回空集合
            return PostFrame.objects.none()
        try:
            user = CustomUser.objects.get(id=user_id)
            return PostFrame.objects.filter(
                user=user,
                contents__isnull=False  # 只包含有內容的貼文，排除疾病檔案
            ).distinct().order_by('-created_at')
        except CustomUser.DoesNotExist:
            return PostFrame.objects.none()
    
    def list(self, request, *args, **kwargs):
        try:
            queryset = self.filter_queryset(self.get_queryset())
            
            # 獲取分頁參數
            page_size = min(int(request.query_params.get('limit', 15)), 50)  # 默認15個，最大50個
            offset = int(request.query_params.get('offset', 0))
            
            # 手動分頁
            total_count = queryset.count()
            posts = queryset[offset:offset + page_size]
            has_more = offset + page_size < total_count
            
            # 序列化數據
            serializer = self.get_serializer(posts, many=True, context={'request': request})
            
            return APIResponse(
                data={
                    'posts': serializer.data,
                    'has_more': has_more,
                    'total_count': total_count,
                    'offset': offset,
                    'limit': page_size
                },
                message="獲取用戶貼文預覽成功"
            )
            
        except ValueError as e:
            return APIResponse(
                message="分頁參數錯誤",
                status=drf_status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"獲取用戶貼文預覽失敗: {str(e)}", exc_info=True)
            return APIResponse(
                message="獲取用戶貼文預覽失敗",
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )

#----------搜尋 API----------
class SearchAPIView(APIView):
    """搜尋 API - 支援用戶、標籤和論壇搜尋"""
    permission_classes = [IsAuthenticated]
    
    @log_queries
    def get(self, request):
        query = request.query_params.get('q', '').strip()
        
        if not query or len(query) < 2:
            return APIResponse(
                data={
                    'users': [],
                    'posts': [],
                    'forums': []
                },
                message="搜尋詞至少需要2個字符"
            )
        
        # 如果以#開頭，搜尋Hashtag
        if query.startswith('#'):
            tag_query = query[1:]  # 去除#符號
            
            hashtags = PostHashtag.objects.filter(tag__icontains=tag_query)
            postFrame_ids = hashtags.values_list('postFrame_id', flat=True)
            solContents = SoLContent.objects.filter(
                postFrame_id__in=postFrame_ids
            ).order_by('-postFrame__created_at')[:50]

            post_serializer = SolPostSerializer(solContents, many=True, context={'request': request})
            
            return APIResponse(
                data={
                    'users': [],  # Hashtag 搜尋不返回使用者
                    'posts': post_serializer.data,
                    'forums': []  # Hashtag 搜尋不返回論壇
                },
                message="根據Hashtag搜尋結果"
            )
        else:
            # 搜尋用戶
            users = CustomUser.objects.filter(
                Q(username__icontains=query) | 
                Q(user_fullname__icontains=query) |
                Q(user_account__icontains=query)
            )[:10]
            
            # 搜尋論壇（DiseaseArchiveContent）- 優先標題，其次內容
            from pets.models import DiseaseArchiveContent
            from pets.serializers import DiseaseArchiveSearchSerializer
            
            # 先搜尋標題匹配的
            forums_by_title = DiseaseArchiveContent.objects.filter(
                archive_title__icontains=query,
                is_private=False  # 只搜尋公開的論壇
            ).select_related('pet', 'postFrame', 'postFrame__user')[:20]
            
            # 再搜尋內容匹配的（排除已經標題匹配的）
            title_ids = list(forums_by_title.values_list('id', flat=True))
            forums_by_content = DiseaseArchiveContent.objects.filter(
                content__icontains=query,
                is_private=False
            ).exclude(
                id__in=title_ids
            ).select_related('pet', 'postFrame', 'postFrame__user')[:30]
            
            # 合併結果，標題匹配的在前
            forums = list(forums_by_title) + list(forums_by_content)
            forums = forums[:30]  # 限制總數為30
            
            forum_serializer = DiseaseArchiveSearchSerializer(forums, many=True, context={'request': request})
            
            if users.exists():
                # 序列化找到的用戶
                user_serializer = UserDetailSearchSerializer(users, many=True)
                
                # 獲取這些用戶的貼文
                user_ids = list(users.values_list('id', flat=True))
                solContents = SoLContent.objects.filter(
                    postFrame__user_id__in=user_ids
                ).order_by('-postFrame__created_at')[:30]

                post_serializer = SolPostSerializer(solContents, many=True, context={'request': request})
                
                return APIResponse(
                    data={
                        'users': user_serializer.data,  # 返回相關使用者
                        'posts': post_serializer.data,   # 返回這些使用者的貼文
                        'forums': forum_serializer.data  # 返回論壇搜尋結果
                    },
                    message="用戶、貼文及論壇搜尋結果"
                )
            else:
                # 若找不到用戶，則從貼文內容中搜尋
                solContents = SoLContent.objects.filter(
                    content_text__icontains=query
                ).order_by('-postFrame__created_at')[:50]

                post_serializer = SolPostSerializer(solContents, many=True, context={'request': request})
                
                return APIResponse(
                    data={
                        'users': [],  # 沒有相關使用者
                        'posts': post_serializer.data,
                        'forums': forum_serializer.data  # 返回論壇搜尋結果
                    },
                    message="根據貼文內容及論壇搜尋結果"
                )

#----------搜尋建議 API----------
class SearchSuggestionAPIView(APIView):
    """搜尋建議 API"""
    permission_classes = [IsAuthenticated]
    
    @log_queries
    def get(self, request):
        query = request.query_params.get('q', '').strip()
        
        if not query or len(query) < 2:
            return APIResponse(
                data=[],
                message="搜尋詞至少需要2個字符"
            )
        
        suggestions = []
        
        # 如果以#開頭，建議Hashtags
        if query.startswith('#'):
            tag_query = query[1:]  # 去除#符號
            hashtags = PostHashtag.objects.filter(
                tag__icontains=tag_query
            ).distinct()[:5]
            
            for hashtag in hashtags:
                suggestions.append({
                    'type': 'hashtag',
                    'value': f'#{hashtag.tag}'
                })
        else:
            # 建議用戶
            users = CustomUser.objects.filter(
                Q(username__icontains=query) | 
                Q(user_fullname__icontains=query) |
                Q(user_account__icontains=query)
            )[:5]
            
            for user in users:
                suggestions.append({
                    'type': 'user',
                    'value': UserBasicSerializer(user).data
                })
                
            # 如果建議不足5個，添加部分hashtag建議
            if len(suggestions) < 5:
                hashtags = PostHashtag.objects.filter(
                    tag__icontains=query
                ).distinct()[:5-len(suggestions)]
                
                for hashtag in hashtags:
                    suggestions.append({
                        'type': 'hashtag',
                        'value': f'#{hashtag.tag}'
                    })
        
        serializer = SearchSuggestionSerializer(suggestions, many=True)
        return APIResponse(
            data=serializer.data,
            message="搜尋建議"
        )

#----------建立貼文 API----------
class CreatePostAPIView(APIView):
    """建立新貼文"""
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request, *args, **kwargs):
        try:
            user = request.user
            content = request.data.get('content', '').strip()
            location = request.data.get('location', '').strip() or None
            uploaded_image_files = request.FILES.getlist('images')
            hashtag_data = request.data.get('hashtags', '')
            pet_ids = request.data.get('pet_ids', '')
            annotations_data = request.data.get('annotations', '')
            
            hashtags = DataHandler.parse_hashtags(content, hashtag_data)
            
            # 驗證必填欄位
            if not content:
                return APIResponse(
                    message="貼文內容不能為空",
                    status=drf_status.HTTP_400_BAD_REQUEST,
                )
            
            # 創建 PostFrame
            postFrame = PostFrame.objects.create(user=user)

            # 創建 SoLContent
            solContent = SoLContent.objects.create(
                postFrame=postFrame,
                content_text=content,
                location=location
            )

            recommendation_service = apps.get_app_config('social').get_recommendation_service()
            recommendation_service.embed_new_post(post_id=postFrame.id, content=content, content_type="social")

            # 創建標籤關聯
            logger.info(f"準備創建標籤，解析得到的標籤: {hashtags}")
            for tag in hashtags:
                if tag:  # 確保標籤不為空
                    # 不使用 slugify，直接使用原始標籤以支援中文
                    created_hashtag = PostHashtag.objects.create(
                        postFrame=postFrame,
                        tag=tag.strip()  # 只移除前後空白，保留中文字符
                    )
                    logger.info(f"成功創建標籤: '{tag}' -> 資料庫中的值: '{created_hashtag.tag}'")
            
            # 驗證標籤是否正確存儲
            saved_hashtags = PostHashtag.objects.filter(postFrame=postFrame)
            logger.info(f"資料庫中實際存儲的標籤: {[h.tag for h in saved_hashtags]}")
            
            # 創建寵物標記關聯
            pets = DataHandler.parse_pets(pet_ids)
            tagged_pet_ids = set()  # 用於追蹤已經標記的寵物，避免重複
            
            for pet in pets:
                # 確認寵物屬於當前用戶
                if pet.owner == user:
                    PostPets.objects.create(
                        postFrame=postFrame,
                        pet=pet
                    )
                    tagged_pet_ids.add(pet.id)
            
            # 處理圖片上傳
            if uploaded_image_files:
                try:
                    from utils.firebase_service import firebase_storage_service
                    from utils.image_service import ImageService
                    
                    # 使用批量上傳方法
                    success, message, uploaded_images = firebase_storage_service.upload_post_images_batch(
                        user_id=user.id,
                        post_id=postFrame.id,
                        image_files=uploaded_image_files
                    )
                    
                    # 保存成功上傳的圖片到資料庫
                    for image_data in uploaded_images:
                        try:
                            ImageService.save_post_image(
                                image_data=image_data,
                                post_frame_id=postFrame.id,
                                user_id=user.id
                            )
                        except Exception as save_error:
                            logger.error(f"保存圖片記錄失敗: {str(save_error)}")
                    
                    # 處理圖片標註
                    if annotations_data and uploaded_images:
                        try:
                            import json
                            if isinstance(annotations_data, str):
                                annotations = json.loads(annotations_data)
                            else:
                                annotations = annotations_data
                            
                            # 為每個標註創建記錄
                            for annotation in annotations:
                                image_index = annotation.get('image_index', 0)
                                
                                # 檢查圖片索引是否有效
                                if image_index < len(uploaded_images):
                                    image_data = uploaded_images[image_index]
                                    firebase_url = image_data.get('firebase_url')
                                    
                                    if firebase_url:
                                        ImageAnnotation.create(
                                            firebase_url=firebase_url,
                                            x_position=float(annotation.get('x_position', 0)),
                                            y_position=float(annotation.get('y_position', 0)),
                                            target_type=annotation.get('target_type', 'user'),
                                            target_id=int(annotation.get('target_id', 0)),
                                            created_by=user
                                        )
                                        logger.info(f"創建標註成功: {annotation.get('target_type')}_{annotation.get('target_id')} 在圖片 {image_index}")
                                        
                                        # 如果標註的是寵物，建立 PostPets 關聯
                                        if annotation.get('target_type') == 'pet':
                                            target_pet_id = int(annotation.get('target_id', 0))
                                            
                                            # 檢查是否已經標記過這個寵物
                                            if target_pet_id not in tagged_pet_ids:
                                                try:
                                                    # 獲取寵物並確認屬於當前用戶
                                                    pet = Pet.objects.get(id=target_pet_id, owner=user)
                                                    PostPets.objects.create(
                                                        postFrame=postFrame,
                                                        pet=pet
                                                    )
                                                    tagged_pet_ids.add(target_pet_id)
                                                    logger.info(f"通過標註建立寵物關聯: {pet.pet_name} (ID: {target_pet_id})")
                                                except Pet.DoesNotExist:
                                                    logger.warning(f"標註的寵物 ID {target_pet_id} 不存在或不屬於當前用戶")
                                                except Exception as pet_error:
                                                    logger.error(f"建立寵物關聯失敗: {str(pet_error)}")
                                else:
                                    logger.warning(f"標註的圖片索引 {image_index} 超出範圍")
                                    
                        except Exception as annotation_error:
                            logger.error(f"處理圖片標註時出錯: {str(annotation_error)}")
                            # 標註創建失敗不影響貼文創建
                    
                    if not success:
                        logger.warning(f"部分圖片上傳失敗: {message}")
                    else:
                        logger.info(f"所有圖片上傳成功: {message}")
                            
                except Exception as img_e:
                    logger.error(f"處理圖片上傳時出錯: {str(img_e)}")
                    # 圖片上傳失敗不影響貼文創建
            
            # 返回創建成功的貼文
            serializer = PostFrameSerializer(postFrame, context={'request': request})
            
            return APIResponse(
                data=serializer.data,
                message="貼文建立成功",
                status=drf_status.HTTP_201_CREATED,
            )
            
        except Exception as e:
            logger.error(f"創建貼文時出錯: {str(e)}", exc_info=True)
            return APIResponse(
                message=f"創建貼文失敗: {str(e)}",
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

#----------貼文圖片上傳 API----------
class PostImageUploadAPIView(APIView):
    """為已存在的貼文上傳圖片（MCP Agent 專用）"""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @transaction.atomic
    def post(self, request, post_id):
        """
        上傳圖片到已存在的貼文

        POST 數據:
        - images: 圖片檔案列表 (必填)
        """
        try:
            user = request.user

            # 1. 驗證貼文是否存在
            try:
                postFrame = PostFrame.objects.get(id=post_id)
            except PostFrame.DoesNotExist:
                return APIResponse(
                    message="貼文不存在",
                    status=drf_status.HTTP_404_NOT_FOUND,
                )

            # 2. 驗證權限：只有貼文作者可以上傳圖片
            if postFrame.user != user:
                return APIResponse(
                    message="您沒有權限為此貼文上傳圖片",
                    status=drf_status.HTTP_403_FORBIDDEN,
                )

            # 3. 獲取上傳的圖片檔案
            uploaded_image_files = request.FILES.getlist('images')

            if not uploaded_image_files:
                return APIResponse(
                    message="請至少上傳一張圖片",
                    status=drf_status.HTTP_400_BAD_REQUEST,
                )

            # 4. 獲取現有圖片數量（用於計算 sort_order）
            from media.models import Image
            existing_images_count = Image.objects.filter(postFrame=postFrame).count()

            # 5. 上傳圖片到 Firebase
            from utils.firebase_service import firebase_storage_service
            from utils.image_service import ImageService

            success, message, uploaded_images = firebase_storage_service.upload_post_images_batch(
                user_id=user.id,
                post_id=postFrame.id,
                image_files=uploaded_image_files,
                start_sort_order=existing_images_count  # 從現有數量開始排序
            )

            if not uploaded_images:
                return APIResponse(
                    message=f"圖片上傳失敗: {message}",
                    status=drf_status.HTTP_400_BAD_REQUEST,
                )

            # 6. 保存成功上傳的圖片到資料庫
            saved_images = []
            for image_data in uploaded_images:
                try:
                    image = ImageService.save_post_image(
                        image_data=image_data,
                        post_frame_id=postFrame.id,
                        user_id=user.id
                    )
                    saved_images.append({
                        'id': image.id,
                        'firebase_url': image.firebase_url,
                        'firebase_path': image.firebase_path,
                        'sort_order': image.sort_order
                    })
                except Exception as save_error:
                    logger.error(f"保存圖片記錄失敗: {str(save_error)}")

            # 7. 記錄日誌
            logger.info(f"用戶 {user.id} 為貼文 {post_id} 上傳了 {len(saved_images)} 張圖片")

            # 8. 返回結果
            return APIResponse(
                data={
                    "success": True,
                    "uploaded_count": len(saved_images),
                    "images": saved_images
                },
                message=f"成功上傳 {len(saved_images)} 張圖片",
                status=drf_status.HTTP_201_CREATED,
            )

        except Exception as e:
            logger.error(f"上傳貼文圖片時出錯: {str(e)}", exc_info=True)
            return APIResponse(
                message=f"上傳圖片失敗: {str(e)}",
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

#----------貼文詳情 API----------
class PostDetailAPIView(generics.RetrieveAPIView):
    """獲取貼文詳情"""
    permission_classes = [IsAuthenticated]
    queryset = PostFrame.objects.all()
    serializer_class = PostFrameSerializer

    def retrieve(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            serializer = PostFrameSerializer(instance, context={'request': request})
            return APIResponse(
                data=serializer.data,
                message="獲取貼文詳情成功"
            )
        except PostFrame.DoesNotExist:
            return APIResponse(
                status=drf_status.HTTP_404_NOT_FOUND,
                message="找不到指定的貼文"
            )
        except Exception as e:
            logger.error(f"獲取貼文詳情失敗: {str(e)}")
            return APIResponse(
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
                message=f"獲取貼文詳情失敗: {str(e)}"
            )

#----------貼文刪除 API----------
class DeletePostAPIView(APIView):
    """刪除貼文及其相關資料"""
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def delete(self, request, pk):
        try:
            # 獲取貼文
            try:
                postFrame = PostFrame.objects.get(id=pk)
            except PostFrame.DoesNotExist:
                return APIResponse(
                    status=drf_status.HTTP_404_NOT_FOUND,
                    message="找不到指定的貼文"
                )
            
            # 檢查權限：只有作者可以刪除
            if postFrame.user != request.user:
                return APIResponse(
                    status=drf_status.HTTP_403_FORBIDDEN,
                    message="您沒有權限刪除此貼文"
                )
            
            # 刪除貼文圖片（包含 Firebase Storage）
            from utils.image_service import ImageService
            try:
                deleted_count, failed_paths = ImageService.delete_post_images(
                    post_frame_id=postFrame.id,
                    delete_from_firebase=True
                )
                
                if failed_paths:
                    logger.warning(f"部分圖片從 Firebase 刪除失敗: {failed_paths}")
                
                logger.info(f"貼文圖片刪除完成: {deleted_count} 張")
                
            except Exception as img_error:
                logger.error(f"刪除貼文圖片時出錯: {str(img_error)}")
                # 繼續刪除貼文，即使圖片刪除失敗
            
            # 刪除圖片標註
            try:
                from media.models import Image
                image_urls = Image.objects.filter(
                    postFrame=postFrame
                ).values_list('firebase_url', flat=True)
                
                if image_urls:
                    deleted_annotations = ImageAnnotation.objects.filter(
                        firebase_url__in=image_urls
                    ).delete()
                    logger.info(f"刪除圖片標註: {deleted_annotations[0]} 個")
                    
            except Exception as annotation_error:
                logger.error(f"刪除圖片標註時出錯: {str(annotation_error)}")
            
            # 刪除貼文相關資料
            try:
                # 刪除標籤
                PostHashtag.objects.filter(postFrame=postFrame).delete()
                
                # 刪除寵物標記
                PostPets.objects.filter(postFrame=postFrame).delete()
                
                # 刪除內容
                SoLContent.objects.filter(postFrame=postFrame).delete()
                
                # 刪除互動記錄
                from interactions.models import UserInteraction
                UserInteraction.objects.filter(interactables=postFrame).delete()
                
                logger.info(f"貼文相關資料刪除完成: post_id={postFrame.id}")
                
            except Exception as data_error:
                logger.error(f"刪除貼文相關資料時出錯: {str(data_error)}")
                # 繼續刪除主貼文

            recommendation_service = apps.get_app_config('social').get_recommendation_service()
            recommendation_service.delete_post_data(post_id=postFrame.id, content_type="social")

            # 最後刪除 PostFrame
            post_id = postFrame.id
            postFrame.delete()
            
            logger.info(f"貼文刪除成功: post_id={post_id}")
            
            return APIResponse(
                message="貼文刪除成功",
                status=drf_status.HTTP_200_OK
            )
            
        except Exception as e:
            logger.error(f"刪除貼文時發生錯誤: {str(e)}", exc_info=True)
            return APIResponse(
                message=f"刪除貼文失敗: {str(e)}",
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )

#----------貼文標記寵物選擇 API----------
class PostTagPetsAPIView(APIView):
    """獲取當前用戶的寵物列表，用於貼文標記"""
    permission_classes = [IsAuthenticated]
    
    @log_queries
    def get(self, request):
        try:
            # 獲取當前用戶的所有寵物
            user_pets = Pet.objects.filter(owner=request.user).order_by('pet_name')
            
            # 使用序列化器處理資料
            serializer = PostTagPetSerializer(user_pets, many=True)
            
            return APIResponse(
                data=serializer.data,
                message="獲取寵物列表成功"
            )
        
        except Exception as e:
            logger.error(f"獲取寵物列表失敗: {str(e)}")
            return APIResponse(
                status=drf_status.HTTP_400_BAD_REQUEST,
                message=f"獲取寵物列表失敗: {str(e)}"
            )

#----------用戶貼文列表 API----------
class UserPostListAPIView(APIView):
    """獲取指定用戶的貼文列表"""
    permission_classes = [IsAuthenticated]
    
    @log_queries
    def get(self, request, pk):
        try:
            # 檢查用戶是否存在
            user = CustomUser.objects.get(id=pk)
            
            # 獲取分頁參數
            limit = min(int(request.query_params.get('limit', 10)), 50)  # 最大50個
            offset = int(request.query_params.get('offset', 0))
            
            # 獲取該用戶的所有貼文內容
            queryset = SoLContent.objects.filter(
                postFrame__user=user
            ).select_related('postFrame').order_by('-postFrame__created_at')
            
            # 手動分頁
            total_count = queryset.count()
            posts = queryset[offset:offset + limit]
            has_more = offset + limit < total_count
            
            # 序列化數據
            serializer = SolPostSerializer(posts, many=True, context={'request': request})
            
            return APIResponse(
                data={
                    'posts': serializer.data,
                    'has_more': has_more,
                    'total_count': total_count,
                    'offset': offset,
                    'limit': limit
                },
                message="獲取用戶貼文列表成功"
            )
            
        except CustomUser.DoesNotExist:
            return APIResponse(
                data={
                    'posts': [],
                    'has_more': False,
                    'total_count': 0,
                    'offset': 0,
                    'limit': limit
                },
                message="用戶不存在"
            )
        except ValueError as e:
            return APIResponse(
                message="分頁參數錯誤",
                status=drf_status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"獲取用戶貼文列表失敗: {str(e)}", exc_info=True)
            return APIResponse(
                message="獲取用戶貼文列表失敗",
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )

#----------全局貼文列表 API----------
class PostListAPIView(generics.ListAPIView):
    """獲取全局貼文列表"""
    permission_classes = [IsAuthenticated]
    serializer_class = PostFrameSerializer
    
    @log_queries
    def get_queryset(self):
        recommendation_service = apps.get_app_config('social').get_recommendation_service()

        history = []
        recommend_list = []
        
        # 如果推薦服務還沒初始化，直接返回最新貼文
        if recommendation_service is None:
            print("推薦服務尚未初始化，返回最新貼文")
            return PostFrame.objects.all().order_by('-created_at')

        # 獲取用戶的互動歷史
        # 先取得用戶和日常貼文SoLContent的互動歷史(互動不包含留言，留言會在下方單獨處理)
        interaction_list = UserInteraction.objects.filter(user=self.request.user)[:50].values()
        for interaction in interaction_list:
            # 先假設用戶互動的是PostFrame，把按讚留言紀錄過濾掉
            postFrame = PostFrame.get_postFrames(postID=interaction['interactables_id'])

            # 根據找到的PostFrame獲取SoLContent(若不是SoLContent則忽略)
            if postFrame is not None:
                solContent = SoLContent.get_content(postFrame)

                if solContent.exists():
                    history.append({
                        "id": interaction['interactables_id'],
                        "action": interaction['relation'],
                        "timestamp": int(interaction['created_at'].timestamp())
                    })

        # 接者處理留言的歷史
        comment_list = Comment.objects.filter(user=self.request.user)[:50].select_related('postFrame')
        for comment in comment_list:
            # 還是先抓留言來自哪個PostFrame
            postFrame = comment.postFrame

            # 根據找到的PostFrame獲取SoLContent(若不是SoLContent則忽略)
            if postFrame is not None:
                solContent = SoLContent.get_content(postFrame)

                if solContent.exists():
                    history.append({
                        "id": postFrame.id,
                        "action": "comment",
                        "timestamp": int(comment.created_at.timestamp())
                    })

        seen_ids = {p['id'] for p in history}

        if len(history) > 0:
            print(len(history), "條互動歷史")

            embedded_history = recommendation_service.embed_user_history(posts=[(p['id'], p['action'], p['timestamp']) for p in history], content_type="social")
            search_list = recommendation_service.recommend_posts(user_vec=embedded_history, content_type="social")

            # Add recommended posts first
            for post_id in search_list:
                if post_id not in seen_ids:
                    recommend_list.append(post_id)
            # Randomly insert seen_ids into recommend_list
            seen_list = list(seen_ids)
            # random.shuffle(seen_list)
            # Insert each seen_id at a random position in recommend_list
            insert_pos = 0
            for seen_id in seen_list:
                # insert_pos = random.randint(0, len(recommend_list))
                offset = datetime.now().day + datetime.now().month + datetime.now().year
                insert_pos = (insert_pos + offset) % (len(recommend_list) + 1)
                recommend_list.insert(insert_pos, seen_id)

            print("推薦結果:", recommend_list)

            return PostFrame.get_postFrames(idList=recommend_list)
        else:
            print("無用戶互動歷史")

            return PostFrame.objects.all().order_by('-created_at')

    def list(self, request, *args, **kwargs):
        try:
            queryset = self.filter_queryset(self.get_queryset())
            
            # 獲取分頁參數
            page_size = min(int(request.query_params.get('limit', 10)), 50)  # 最大50個
            offset = int(request.query_params.get('offset', 0))
            
            # 手動分頁
            total_count = queryset.count()
            posts = queryset[offset:offset + page_size]
            has_more = offset + page_size < total_count
            
            # 序列化數據
            serializer = self.get_serializer(posts, many=True, context={'request': request})
            
            return APIResponse(
                data={
                    'posts': serializer.data,
                    'has_more': has_more,
                    'total_count': total_count,
                    'offset': offset,
                    'limit': page_size
                },
                message="獲取貼文列表成功"
            )
            
        except ValueError as e:
            return APIResponse(
                message="分頁參數錯誤",
                status=drf_status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"獲取貼文列表失敗: {str(e)}", exc_info=True)
            return APIResponse(
                message="獲取貼文列表失敗",
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )

#----------圖片標註權限檢查 API----------
class CheckAnnotationPermissionAPIView(APIView):
    """
    檢查圖片標註權限的 API
    
    檢查被標註的使用者是否：
    1. 存在
    2. 帳號為公開 OR 當前使用者已追蹤該使用者且已確認
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, user_account):
        """
        檢查是否可以標註指定使用者
        
        Parameters:
        - user_account: 被標註使用者的帳號
        
        Returns:
        - bool: can_annotate - 是否可以標註
        - str: reason - 不能標註的原因（如果不能標註）
        - dict: user_info - 使用者基本資訊（如果可以標註）
        """
        try:
            # 檢查被標註的使用者是否存在
            try:
                target_user = CustomUser.objects.get(user_account=user_account)
            except CustomUser.DoesNotExist:
                return APIResponse(
                    data={
                        'can_annotate': False,
                        'reason': '使用者不存在',
                        'user_info': None
                    },
                    message='使用者不存在',
                    status=drf_status.HTTP_404_NOT_FOUND
                )
            
            # 不能標註自己
            if target_user == request.user:
                return APIResponse(
                    data={
                        'can_annotate': False,
                        'reason': '不能標註自己',
                        'user_info': None
                    },
                    message='不能標註自己',
                    status=drf_status.HTTP_400_BAD_REQUEST
                )
            
            # 檢查帳號隱私設定
            if target_user.account_privacy == 'public':
                # 公開帳號，可以標註
                user_info = self._get_user_basic_info(target_user)
                return APIResponse(
                    data={
                        'can_annotate': True,
                        'reason': None,
                        'user_info': user_info
                    },
                    message='可以標註此使用者',
                    status=drf_status.HTTP_200_OK
                )
            
            # 私人帳號，檢查追蹤關係
            from accounts.models import UserFollow
            
            try:
                follow_relation = UserFollow.objects.get(
                    user=request.user,
                    follows=target_user,
                    confirm_or_not=True  # 必須已確認
                )
                
                # 有追蹤且已確認，可以標註
                user_info = self._get_user_basic_info(target_user)
                return APIResponse(
                    data={
                        'can_annotate': True,
                        'reason': None,
                        'user_info': user_info
                    },
                    message='可以標註此使用者',
                    status=drf_status.HTTP_200_OK
                )
                
            except UserFollow.DoesNotExist:
                # 沒有追蹤關係或未確認
                return APIResponse(
                    data={
                        'can_annotate': False,
                        'reason': '此為私人帳號且您未追蹤該使用者',
                        'user_info': None
                    },
                    message='此為私人帳號且您未追蹤該使用者',
                    status=drf_status.HTTP_403_FORBIDDEN
                )
        
        except Exception as e:
            logger.error(f"檢查標註權限時發生錯誤: {str(e)}")
            return APIResponse(
                data={
                    'can_annotate': False,
                    'reason': f'檢查權限時發生錯誤: {str(e)}',
                    'user_info': None
                },
                message=f'檢查權限失敗: {str(e)}',
                code=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _get_user_basic_info(self, user):
        """
        獲取使用者基本資訊
        
        Parameters:
        - user: CustomUser 物件
        
        Returns:
        - dict: 使用者基本資訊
        """
        headshot_url = None
        try:
            if hasattr(user, 'headshot') and user.headshot:
                headshot_url = user.headshot.firebase_url
        except:
            headshot_url = None
        
        return {
            'id': user.id,
            'username': user.username,
            'user_account': user.user_account,
            'user_fullname': user.user_fullname,
            'headshot_url': headshot_url,
            'account_privacy': user.account_privacy
        }

#----------圖片標註管理 API----------
class ImageAnnotationListCreateAPIView(APIView):
    """圖片標註列表和創建 API"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """獲取圖片標註列表"""
        firebase_url = request.query_params.get('firebase_url')
        
        if not firebase_url:
            return APIResponse(
                message="請提供圖片 URL",
                status=drf_status.HTTP_400_BAD_REQUEST
            )
        
        try:
            annotations = ImageAnnotation.get_annotations_by_image(firebase_url)
            serializer = ImageAnnotationSerializer(annotations, many=True)
            
            return APIResponse(
                data=serializer.data,
                message="獲取圖片標註成功"
            )
        except Exception as e:
            logger.error(f"獲取圖片標註失敗: {str(e)}")
            return APIResponse(
                message=f"獲取圖片標註失敗: {str(e)}",
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def post(self, request):
        """創建新的圖片標註"""
        try:
            firebase_url = request.data.get('firebase_url')
            x_position = request.data.get('x_position')
            y_position = request.data.get('y_position')
            target_type = request.data.get('target_type')
            target_id = request.data.get('target_id')
            
            # 驗證必填欄位
            if not all([firebase_url, x_position is not None, y_position is not None, 
                       target_type, target_id]):
                return APIResponse(
                    message="缺少必要的標註資訊",
                    status=drf_status.HTTP_400_BAD_REQUEST
                )
            
            # 創建標註
            annotation = ImageAnnotation.create(
                firebase_url=firebase_url,
                x_position=float(x_position),
                y_position=float(y_position),
                target_type=target_type,
                target_id=int(target_id),
                created_by=request.user
            )
            
            # 如果標註的是寵物，建立 PostPet 關聯
            if target_type == 'pet':
                logger.info(f"嘗試為寵物標註建立 PostPet 關聯: target_id={target_id}, firebase_url={firebase_url}")
                try:
                    # 透過 firebase_url 找到對應的 PostFrame
                    post_image = Image.objects.filter(firebase_url=firebase_url).first()
                    logger.info(f"找到的 Image: {post_image}")
                    
                    if post_image:
                        post_frame = post_image.postFrame
                        logger.info(f"找到的 PostFrame: {post_frame.id}")
                        
                        # 獲取寵物並確認屬於當前用戶
                        pet = Pet.objects.get(id=int(target_id), owner=request.user)
                        logger.info(f"找到的寵物: {pet.pet_name} (ID: {pet.id})")
                        
                        # 檢查是否已經存在 PostPet 關聯，避免重複
                        existing_relation = PostPets.objects.filter(postFrame=post_frame, pet=pet).first()
                        if not existing_relation:
                            PostPets.objects.create(
                                postFrame=post_frame,
                                pet=pet
                            )
                            logger.info(f"成功建立寵物關聯: {pet.pet_name} (ID: {target_id}) 與貼文 {post_frame.id}")
                        else:
                            logger.info(f"PostPet 關聯已存在: {pet.pet_name} (ID: {target_id}) 與貼文 {post_frame.id}")
                        
                    else:
                        logger.warning(f"無法找到 firebase_url 對應的 Image: {firebase_url}")
                        
                except Pet.DoesNotExist:
                    logger.warning(f"標註的寵物 ID {target_id} 不存在或不屬於當前用戶")
                except Exception as pet_error:
                    logger.error(f"建立寵物關聯失敗: {str(pet_error)}")
            else:
                logger.info(f"標註類型不是寵物: {target_type}")
            
            serializer = ImageAnnotationSerializer(annotation)
            
            return APIResponse(
                data=serializer.data,
                message="標註創建成功",
                status=drf_status.HTTP_201_CREATED
            )
            
        except Exception as e:
            logger.error(f"創建圖片標註失敗: {str(e)}")
            return APIResponse(
                message=f"創建標註失敗: {str(e)}",
                status=drf_status.HTTP_400_BAD_REQUEST
            )

class ImageAnnotationDetailAPIView(APIView):
    """圖片標註詳情、更新和刪除 API"""
    permission_classes = [IsAuthenticated]
    
    def get_object(self, annotation_id):
        """獲取標註物件"""
        try:
            return ImageAnnotation.objects.get(id=annotation_id)
        except ImageAnnotation.DoesNotExist:
            return None
    
    def get(self, request, annotation_id):
        """獲取標註詳情"""
        annotation = self.get_object(annotation_id)
        if not annotation:
            return APIResponse(
                message="找不到指定的標註",
                status=drf_status.HTTP_404_NOT_FOUND
            )
        
        serializer = ImageAnnotationSerializer(annotation)
        return APIResponse(
            data=serializer.data,
            message="獲取標註詳情成功"
        )
    
    def put(self, request, annotation_id):
        """更新標註"""
        annotation = self.get_object(annotation_id)
        if not annotation:
            return APIResponse(
                message="找不到指定的標註",
                status=drf_status.HTTP_404_NOT_FOUND
            )
        
        # 檢查權限：只有創建者可以更新
        if annotation.created_by != request.user:
            return APIResponse(
                message="您沒有權限修改此標註",
                status=drf_status.HTTP_403_FORBIDDEN
            )
        
        try:
            x_position = request.data.get('x_position')
            y_position = request.data.get('y_position')
            
            success = annotation.update_annotation(
                x_position=float(x_position) if x_position is not None else None,
                y_position=float(y_position) if y_position is not None else None
            )
            
            if success:
                serializer = ImageAnnotationSerializer(annotation)
                return APIResponse(
                    data=serializer.data,
                    message="標註更新成功"
                )
            else:
                return APIResponse(
                    message="沒有需要更新的內容",
                    status=drf_status.HTTP_400_BAD_REQUEST
                )
                
        except Exception as e:
            logger.error(f"更新標註失敗: {str(e)}")
            return APIResponse(
                message=f"更新標註失敗: {str(e)}",
                status=drf_status.HTTP_400_BAD_REQUEST
            )
    
    def delete(self, request, annotation_id):
        """刪除標註"""
        annotation = self.get_object(annotation_id)
        if not annotation:
            return APIResponse(
                message="找不到指定的標註",
                status=drf_status.HTTP_404_NOT_FOUND
            )
        
        # 檢查權限：只有創建者可以刪除
        if annotation.created_by != request.user:
            return APIResponse(
                message="您沒有權限刪除此標註",
                status=drf_status.HTTP_403_FORBIDDEN
            )
        
        try:
            # 如果刪除的是寵物標註，檢查是否需要移除 PostPet 關聯
            if annotation.target_type == 'pet':
                try:
                    # 透過 firebase_url 找到對應的 PostFrame
                    post_image = Image.objects.filter(firebase_url=annotation.firebase_url).first()
                    if post_image:
                        post_frame = post_image.postFrame
                        pet_id = annotation.target_id
                        
                        # 檢查該貼文是否還有其他寵物標註
                        remaining_pet_annotations = ImageAnnotation.objects.filter(
                            target_type='pet',
                            target_id=pet_id
                        ).exclude(id=annotation.id)
                        
                        # 檢查是否還有其他圖片標註了同一隻寵物
                        has_other_pet_annotations = False
                        for other_annotation in remaining_pet_annotations:
                            # 檢查是否屬於同一個貼文
                            other_post_image = Image.objects.filter(firebase_url=other_annotation.firebase_url).first()
                            if other_post_image and other_post_image.postFrame.id == post_frame.id:
                                has_other_pet_annotations = True
                                break
                        
                        # 如果沒有其他標註了這隻寵物，刪除 PostPet 關聯
                        if not has_other_pet_annotations:
                            PostPets.objects.filter(
                                postFrame=post_frame,
                                pet_id=pet_id
                            ).delete()
                            logger.info(f"刪除寵物關聯: 寵物 ID {pet_id} 與貼文 {post_frame.id}")
                        
                except Exception as pet_error:
                    logger.error(f"處理寵物關聯刪除失敗: {str(pet_error)}")
            
            annotation.delete()
            return APIResponse(
                message="標註刪除成功"
            )
        except Exception as e:
            logger.error(f"刪除標註失敗: {str(e)}")
            return APIResponse(
                message=f"刪除標註失敗: {str(e)}",
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )

#----------寵物相關貼文列表 API----------
class PetRelatedPostsAPIView(APIView):
    """獲取指定寵物的相關貼文列表"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pet_id):
        try:
            # 檢查寵物是否存在且用戶有權限查看
            try:
                pet = Pet.objects.get(id=pet_id)
            except Pet.DoesNotExist:
                return APIResponse(
                    message="找不到指定的寵物",
                    status=drf_status.HTTP_404_NOT_FOUND
                )
            
            # 檢查權限：只有寵物主人可以查看
            if pet.owner != request.user:
                return APIResponse(
                    message="您沒有權限查看此寵物的相關貼文",
                    status=drf_status.HTTP_403_FORBIDDEN
                )
            
            # 獲取排序參數
            sort_option = request.GET.get('sort', 'post_date_desc')
            
            # 通過 PostPets 模型獲取包含該寵物的所有貼文
            pet_posts = PostPets.objects.filter(pet=pet).select_related('postFrame')
            
            # 提取 PostFrame 對象
            post_frames = [pet_post.postFrame for pet_post in pet_posts]
            
            # 根據排序選項排序
            if sort_option == 'post_date_desc':
                post_frames.sort(key=lambda x: x.created_at, reverse=True)
            elif sort_option == 'post_date_asc':
                post_frames.sort(key=lambda x: x.created_at, reverse=False)
            else:
                # 預設按發布日期降序
                post_frames.sort(key=lambda x: x.created_at, reverse=True)
            
            # 序列化貼文數據
            serializer = PostFrameSerializer(
                post_frames, 
                many=True, 
                context={'request': request}
            )
            
            return APIResponse(
                data={"posts": serializer.data},
                message="獲取寵物相關貼文成功"
            )
            
        except Exception as e:
            logger.error(f"獲取寵物相關貼文失敗: {str(e)}")
            return APIResponse(
                message=f"獲取寵物相關貼文失敗: {str(e)}",
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )

#----------更新貼文 API----------
class UpdatePostAPIView(APIView):
    """更新現有貼文"""
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def put(self, request, pk):
        try:
            # 獲取貼文
            try:
                postFrame = PostFrame.objects.get(id=pk)
            except PostFrame.DoesNotExist:
                return APIResponse(
                    status=drf_status.HTTP_404_NOT_FOUND,
                    message="找不到指定的貼文"
                )
            
            # 檢查權限：只有作者可以編輯
            if postFrame.user != request.user:
                return APIResponse(
                    status=drf_status.HTTP_403_FORBIDDEN,
                    message="您沒有權限編輯此貼文"
                )
            
            user = request.user
            content = request.data.get('content', '').strip()
            location = request.data.get('location', '').strip() or None
            hashtag_data = request.data.get('hashtags', '')
            
            # 處理新增圖片
            uploaded_image_files = request.FILES.getlist('images')
            
            # 驗證必填欄位
            if not content:
                return APIResponse(
                    message="貼文內容不能為空",
                    status=drf_status.HTTP_400_BAD_REQUEST,
                )
            
            # 更新 SoLContent
            try:
                solContent = SoLContent.objects.get(postFrame=postFrame)
                solContent.content_text = content
                solContent.location = location
                solContent.save()
            except SoLContent.DoesNotExist:
                # 如果沒有內容，創建新的
                solContent = SoLContent.objects.create(
                    postFrame=postFrame,
                    content_text=content,
                    location=location
                )

            recommendation_service = apps.get_app_config('social').get_recommendation_service()
            recommendation_service.delete_post_data(post_id=postFrame.id, content_type="social")
            recommendation_service.embed_new_post(post_id=postFrame.id, content=content, content_type="social")

            # 處理標籤更新
            hashtags = DataHandler.parse_hashtags(content, hashtag_data)
            
            # 刪除舊標籤
            PostHashtag.objects.filter(postFrame=postFrame).delete()
            
            # 創建新標籤
            logger.info(f"準備更新標籤，解析得到的標籤: {hashtags}")
            for tag in hashtags:
                if tag:  # 確保標籤不為空
                    created_hashtag = PostHashtag.objects.create(
                        postFrame=postFrame,
                        tag=tag.strip()
                    )
                    logger.info(f"成功更新標籤: '{tag}' -> 資料庫中的值: '{created_hashtag.tag}'")
            
            # 驗證標籤是否正確存儲
            saved_hashtags = PostHashtag.objects.filter(postFrame=postFrame)
            logger.info(f"資料庫中實際存儲的標籤: {[h.tag for h in saved_hashtags]}")
            
            # 處理新增圖片上傳
            if uploaded_image_files:
                from utils.firebase_service import firebase_storage_service
                from utils.image_service import ImageService
                
                logger.info(f"開始上傳 {len(uploaded_image_files)} 張圖片到貼文 {postFrame.id}")
                
                # 獲取當前圖片的最大排序值
                from media.models import Image

                current_max_sort_order = Image.objects.filter(
                    postFrame=postFrame
                ).aggregate(Max('sort_order'))['sort_order__max'] or -1
                
                # 批量上傳圖片到 Firebase
                success, message, uploaded_images = firebase_storage_service.upload_post_images_batch(
                    user_id=user.id,
                    post_id=postFrame.id,
                    image_files=uploaded_image_files,
                    start_sort_order=current_max_sort_order + 1
                )
                
                if success:
                    # 將圖片資訊保存到資料庫
                    for image_data in uploaded_images:
                        try:
                            ImageService.save_post_image(
                                image_data=image_data,
                                post_frame_id=postFrame.id,
                                user_id=user.id
                            )
                            logger.info(f"成功保存圖片到資料庫: {image_data.get('firebase_url', 'Unknown')}")
                        except Exception as img_save_error:
                            logger.error(f"保存圖片到資料庫失敗: {str(img_save_error)}")
                    
                    # 清除圖片快取
                    ImageService.invalidate_post_image_cache(postFrame.id)
                    logger.info(f"成功上傳並保存 {len(uploaded_images)} 張圖片")
                else:
                    logger.error(f"圖片上傳失敗: {message}")
                    raise Exception(f"圖片上傳失敗: {message}")
            
            # 更新 PostFrame 的 updated_at 時間
            postFrame.updated_at = timezone.now()
            postFrame.save(update_fields=['updated_at'])
            
            # 返回更新後的貼文
            serializer = PostFrameSerializer(postFrame, context={'request': request})
            
            return APIResponse(
                data=serializer.data,
                message="貼文更新成功",
                status=drf_status.HTTP_200_OK,
            )
            
        except Exception as e:
            logger.error(f"更新貼文時出錯: {str(e)}", exc_info=True)
            return APIResponse(
                message=f"更新貼文失敗: {str(e)}",
                status=drf_status.HTTP_400_BAD_REQUEST,
            )