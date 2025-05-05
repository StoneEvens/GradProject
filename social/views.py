from rest_framework import generics, status
from .models import Post, PostHashtag
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
        # 只需要 select_related user，因為 PostPreviewSerializer 目前不使用 user 數據
        return Post.objects.filter(user_id=user_id).select_related(
            'user'
        ).order_by('-created_at')
    
    # 覆寫 list 方法以使用統一的 APIResponse 格式，並優化圖片查詢
    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        
        # 獲取所有貼文 ID
        post_ids = list(queryset.values_list('id', flat=True))
        
        # 使用 ImageService 一次性查詢所有相關圖片
        post_images = {}
        if post_ids:
            # 預加載每個貼文的第一張圖片
            image_map = ImageService.preload_first_image_for_objects(queryset, model_class=Post)
            
            # 將圖片映射轉換為 URL 映射
            for post_id, image in image_map.items():
                if image and hasattr(image.img_url, 'url'):
                    post_images[post_id] = image.img_url.url
        
        # 如果使用分頁，處理分頁
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            
            # 修改序列化器數據，直接使用預加載的圖片
            for item in serializer.data:
                post_id = item['id']
                item['first_image_url'] = post_images.get(post_id)
            
            return self.get_paginated_response(serializer.data)
        
        # 如果不使用分頁
        serializer = self.get_serializer(queryset, many=True)
        
        # 修改序列化器數據，直接使用預加載的圖片
        for item in serializer.data:
            post_id = item['id']
            item['first_image_url'] = post_images.get(post_id)
        
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
            content = request.data.get('content', '')
            hashtag_data = request.data.get('hashtags', [])
            pet_ids = request.data.get('pet_ids', [])
            images = request.FILES.getlist('images', [])
            
            # 創建貼文
            post = Post.objects.create(
                user=request.user,
                content=content
            )
            
            # 提取並保存標籤(hashtags)
            # 從內容中提取的標籤
            extracted_hashtags = set(re.findall(r'#(\w+)', content))
            
            # 從前端直接傳來的標籤
            if isinstance(hashtag_data, str):
                try:
                    hashtag_data = json.loads(hashtag_data)
                except json.JSONDecodeError:
                    hashtag_data = []
            
            # 合併所有標籤
            all_hashtags = set(hashtag_data) | extracted_hashtags
            
            # 保存所有標籤
            for tag in all_hashtags:
                tag = slugify(tag)  # 標準化標籤格式
                if tag:  # 確保標籤不為空
                    PostHashtag.objects.create(
                        post=post,
                        tag=tag
                    )
            
            # 處理寵物標記功能
            # 確認寵物是否屬於該使用者並建立關聯
            if pet_ids:
                if isinstance(pet_ids, str):
                    try:
                        pet_ids = json.loads(pet_ids)
                    except json.JSONDecodeError:
                        pet_ids = []
                
                user_pets = Pet.objects.filter(
                    owner=request.user,
                    id__in=pet_ids
                )
                
                # 創建寵物與貼文的關聯
                post_content_type = ContentType.objects.get_for_model(Post)
                for pet in user_pets:
                    PetGenericRelation.objects.create(
                        pet=pet,
                        content_type=post_content_type,
                        object_id=post.id
                    )
            
            # 處理圖片上傳
            for index, image_file in enumerate(images):
                # 保存圖片
                img = Image.objects.create(
                    content_type=ContentType.objects.get_for_model(Post),
                    object_id=post.id,
                    img_url=image_file,
                    sort_order=index,
                    alt_text=f"{request.user.username}的貼文圖片 {index+1}"
                )
            
            # 返回創建成功的貼文
            serializer = PostSerializer(post, context={'request': request})
            
            return APIResponse(
                status=status.HTTP_201_CREATED,
                data=serializer.data,
                message="貼文建立成功"
            )
            
        except Exception as e:
            return APIResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message=f"貼文建立失敗: {str(e)}",
                errors={"detail": str(e)}
            )

# === 貼文詳情 API ===
class PostDetailAPIView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PostSerializer
    queryset = Post.objects.all()
    
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
                status=status.HTTP_404_NOT_FOUND,
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
                status=status.HTTP_400_BAD_REQUEST,
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

