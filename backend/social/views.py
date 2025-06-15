from rest_framework import generics, status as drf_status
from .models import PostHashtag
from .serializers import *
from rest_framework.permissions import IsAuthenticated
from utils.api_response import APIResponse
from utils.query_optimization import log_queries
from utils.image_service import ImageService
from django.contrib.contenttypes.models import ContentType
from media.models import Image, PetHeadshot
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Q
from django.contrib.auth import get_user_model
from pets.models import Pet, PetGenericRelation
from django.db import transaction
from django.utils.text import slugify
import json
import re

User = get_user_model()

#使用者社群首頁post預覽圖
class UserPostsPreviewListAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PostPreviewSerializer

    @log_queries
    def get_queryset(self):
        user_id = self.kwargs['pk']
        # 只需要 select_related user，如果 PostPreviewSerializer 不需要 user 數據則可移除
        # 預加載圖片以優化 SerializerMethodField
        # 假設 Image 模型通過 GenericRelation 與 Post 關聯，related_query_name 可能是 'images'
        # 需要根據 Image 與 Post 的實際關聯方式調整 prefetch_related
        # ContentType.objects.get_for_model(Post) 可以用於過濾 Image
        
        # 由於 first_image_url 在 Serializer 中查詢，這裡可以簡化
        # 如果 Serializer 中的查詢效率不高，可以考慮在此處預加載 Post 的第一張 Image
        return Post.objects.filter(user_id=user_id).select_related(
            'user' # 如果 serializer 需要 user
        ).order_by('-created_at')
    
    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        
        # 如果使用分頁，處理分頁
        page = self.paginate_queryset(queryset)
        if page is not None:
            # context={'request': request}  如果序列化器需要 request context
            serializer = self.get_serializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
        
        # 如果不使用分頁
        serializer = self.get_serializer(queryset, many=True, context={'request': request})
        
        return APIResponse(
            data=serializer.data,
            message="獲取用戶貼文預覽成功"
        )

# === 搜尋 API ===
class SearchAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    @log_queries
    def get(self, request):
        query = request.query_params.get('q', '')
        
        if not query or len(query) < 2:
            return APIResponse(
                data={
                    'users': [],
                    'posts': []
                },
                message="搜尋詞至少需要2個字符"
            )
        
        # 如果以#開頭，搜尋Hashtag
        if query.startswith('#'):
            tag_query = query[1:]  # 去除#符號
            posts = self._search_by_hashtag(tag_query)
            post_serializer = PostSearchSerializer(posts, many=True, context={'request': request})
            
            return APIResponse(
                data={
                    'users': [],  # Hashtag 搜尋不返回使用者
                    'posts': post_serializer.data
                },
                message="根據Hashtag搜尋結果"
            )
        else:
            # 先嘗試查找用戶
            users = self._search_users(query)
            
            if users.exists():
                # 序列化找到的用戶
                user_serializer = UserDetailSearchSerializer(users, many=True)
                
                # 獲取這些用戶的貼文
                user_ids = list(users.values_list('id', flat=True))
                posts = Post.objects.filter(user__in=user_ids).select_related('user').order_by('-created_at')
                post_serializer = PostSearchSerializer(posts, many=True, context={'request': request})
                
                return APIResponse(
                    data={
                        'users': user_serializer.data,  # 返回相關使用者
                        'posts': post_serializer.data   # 返回這些使用者的貼文
                    },
                    message="用戶及其貼文搜尋結果"
                )
            else:
                # 若找不到用戶，則從貼文內容中搜尋
                posts = self._search_posts_by_content(query)
                post_serializer = PostSearchSerializer(posts, many=True, context={'request': request})
                
                return APIResponse(
                    data={
                        'users': [],  # 沒有相關使用者
                        'posts': post_serializer.data
                    },
                    message="根據貼文內容搜尋結果"
                )
    
    def _search_by_hashtag(self, tag_query):
        hashtags = PostHashtag.objects.filter(tag__icontains=tag_query)
        post_ids = hashtags.values_list('post_id', flat=True)
        return Post.objects.filter(id__in=post_ids).select_related('user').order_by('-created_at')
    
    def _search_users(self, query):
        return User.objects.filter(
            Q(username__icontains=query) | 
            Q(user_fullname__icontains=query) |
            Q(user_account__icontains=query)
        )
    
    def _search_posts_by_content(self, query):
        return Post.objects.filter(content__icontains=query).select_related('user').order_by('-created_at')

# === 搜尋建議 API ===
class SearchSuggestionAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    @log_queries
    def get(self, request):
        query = request.query_params.get('q', '')
        
        if not query or len(query) < 2:
            return APIResponse(
                data=[],
                message="搜尋詞至少需要2個字符"
            )
        
        suggestions = []
        
        # 如果以#開頭，建議Hashtags
        if query.startswith('#'):
            tag_query = query[1:]  # 去除#符號
            hashtags = PostHashtag.objects.filter(tag__icontains=tag_query).values_list('tag', flat=True).distinct()[:5]
            
            for tag in hashtags:
                suggestions.append({
                    'type': 'hashtag',
                    'value': f'#{tag}'
                })
        else:
            # 建議用戶
            users = User.objects.filter(
                Q(username__icontains=query) | 
                Q(user_fullname__icontains=query) |
                Q(user_account__icontains=query)
            )[:5]
            
            for user in users:
                suggestions.append({
                    'type': 'user',
                    'value': f'{user.user_fullname} ({user.user_account})'
                })
                
            # 如果建議不足5個，添加部分hashtag建議
            if len(suggestions) < 5:
                hashtags = PostHashtag.objects.filter(tag__icontains=query).values_list('tag', flat=True).distinct()[:5-len(suggestions)]
                
                for tag in hashtags:
                    suggestions.append({
                        'type': 'hashtag',
                        'value': f'#{tag}'
                    })
        
        serializer = SearchSuggestionSerializer(suggestions, many=True)
        return APIResponse(
            data=serializer.data,
            message="搜尋建議"
        )

# === 建立貼文 API ===
class CreatePostAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request, *args, **kwargs):
        """
        建立新的貼文，可以包含文字內容、標籤和寵物標記
        """
        try:
            # 獲取基本貼文數據
            user = request.user
            content = request.data.get('content', '')
            uploaded_image_files = request.FILES.getlist('images')
            hashtag_data = request.data.get('hashtags', [])
            pet_ids = request.data.get('pet_ids', [])

            if (user is None or not user.is_authenticated):
                print("用戶未登錄或無效")
            else:
                print(f"當前用戶: {user.username} (ID: {user.id})")
            
            # 創建貼文
            post = Post.objects.create(
                user=user,
                content=content
            )

            # 更新 Hashtags (從內容提取和前端提供)
            post.update_hashtags(content, hashtag_data) 
            
            # 標記寵物
            # 確保 pet_ids 是列表
            parsed_pet_ids = []
            if isinstance(pet_ids, str):
                try:
                    parsed_pet_ids = json.loads(pet_ids)
                    if not isinstance(parsed_pet_ids, list):
                        parsed_pet_ids = [parsed_pet_ids] # 如果解析出來不是列表，嘗試轉為列表
                except json.JSONDecodeError:
                    # 如果不是有效的JSON字符串，可以嘗試按逗號分割等方式，或忽略
                    # logger.warning(f"無法解析 pet_ids JSON 字串: {pet_ids}")
                    parsed_pet_ids = [] # 或者根據業務邏輯處理
            elif isinstance(pet_ids, list):
                parsed_pet_ids = pet_ids
            
            if parsed_pet_ids: # 只有在解析出 ID 後才調用
                post.tag_pets(parsed_pet_ids)
            
            # 處理圖片上傳 (使用 ImageService 風格)
            if uploaded_image_files:
                # from utils.image_service import ImageService # 確保 ImageService 已導入
                # from django.contrib.contenttypes.models import ContentType
                # post_content_type = ContentType.objects.get_for_model(Post)
                for index, image_file_obj in enumerate(uploaded_image_files):
                    try:
                        ImageService.save_image(
                            image_file=image_file_obj,
                            owner=user, # 使用當前用戶作為擁有者
                            content_object=post, # 直接傳遞 Post 實例
                            image_type='post_image', # 定義一個合適的圖片類型
                            sort_order=index,
                            alt_text=f"{user.username} 的貼文圖片 {index+1}"
                        )
                    except Exception as img_e:
                        # logger.error(f"保存貼文圖片時出錯: {str(img_e)}", exc_info=True)
                        # 根據需求決定是否中止，或僅記錄錯誤並繼續
                        pass 
            
            # 返回創建成功的貼文
            serializer = PostSerializer(post, context={'request': request})
            
            return APIResponse(
                data=serializer.data,
                message="貼文建立成功",
                status=drf_status.HTTP_201_CREATED,
            )
            
        except Exception as e:
            print(f"創建貼文時出錯: {str(e)}")  # 使用 print 代替 logger
            return APIResponse(
                message="創建貼文失敗",
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

# === 貼文詳情 API ===
class PostDetailAPIView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PostSerializer
    queryset = PostFrame.objects.all()
    
    def retrieve(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            serializer = self.get_serializer(instance)
            return APIResponse(
                data=serializer.data,
                message="獲取貼文詳情成功"
            )
        except Exception as e:
            return APIResponse(
                status=drf_status.HTTP_404_NOT_FOUND,
                message=f"獲取貼文詳情失敗: {str(e)}",
                errors={"detail": str(e)}
            )

# === 貼文標記寵物選擇 API ===
class PostTagPetsAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    @log_queries
    def get(self, request):
        """
        獲取當前用戶的寵物列表，用於貼文標記寵物的選擇
        僅返回必要的資訊：pet_id, pet_name, headshot_url
        """
        try:
            # 獲取當前用戶的所有寵物
            user_pets = Pet.objects.filter(owner=request.user)
            
            # 使用序列化器處理資料
            serializer = PostTagPetSerializer(user_pets, many=True)
            
            return APIResponse(
                data=serializer.data,
                message="獲取寵物列表成功"
            )
        
        except Exception as e:
            return APIResponse(
                status=drf_status.HTTP_400_BAD_REQUEST,
                message=f"獲取寵物列表失敗: {str(e)}",
                errors={"detail": str(e)}
            )

# === 用戶貼文列表 API ===
class UserPostListAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PostSerializer
    
    @log_queries
    def get_queryset(self):
        user_id = self.kwargs.get('pk')
        
        # 檢查用戶是否存在
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Post.objects.none()
        
        # 按創建時間降序獲取該用戶的所有貼文
        return Post.objects.filter(user=user).select_related(
            'user'
        ).order_by('-created_at')
    
    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        
        # 處理分頁
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        # 如果不使用分頁
        serializer = self.get_serializer(queryset, many=True)
        
        return APIResponse(
            data=serializer.data,
            message="獲取用戶貼文列表成功"
        )

