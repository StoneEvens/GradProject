from rest_framework import generics, status as drf_status
from .models import PostHashtag, PostFrame, SoLContent, PostPets
from .serializers import *
from rest_framework.permissions import IsAuthenticated
from utils.api_response import APIResponse
from utils.query_optimization import log_queries
from utils.image_service import ImageService
from django.contrib.contenttypes.models import ContentType
from media.models import Image, PetHeadshot
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Q, QuerySet
from django.contrib.auth import get_user_model
from pets.models import Pet
from accounts.models import CustomUser
from django.db import transaction
from django.utils.text import slugify
import json
import re

User = get_user_model()

class DataHandler:
    def parse_hashtags(self, content:str, tags:str):
        implicit_tags = re.findall(r'#(\w+)', content)
        explicit_tags = tags.split(',') if tags else []

        hashtags = slugify(set(implicit_tags + explicit_tags))

        return hashtags
    
    def parse_pets(self, pet_ids: str):
        ids = str.split(pet_ids, ',')
        pets = [Pet]

        for id in ids:
            pet = Pet.get_pet(id)
            pets.append(pet)

        return pets
# 
#使用者社群首頁post預覽圖
class UserPostsPreviewListAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PostPreviewSerializer
    
    def list(self, request, *args, **kwargs):
        id = self.kwargs['pk']
        user = CustomUser.get_user(id=id)
        solContents = SoLContent.get_content(user=user)
        
        # 如果使用分頁，處理分頁
        page = self.paginate_queryset(solContents)
        if page is not None:
            # context={'request': request}  如果序列化器需要 request context
            serializer = SolPostSerializer(page, many=True, context={'request': request})
            
            return APIResponse(
                data=serializer.data,
                message="Success"
            )
        
        # 如果不使用分頁
        serializer = SolPostSerializer(solContents, many=True, context={'request': request})
        
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
            
            hashtags = PostHashtag.get_hashtags(query=tag_query)
            postFrameList = PostHashtag.get_postFrame(hashtags.values_list('postFrame_id', flat=True))
            solContents = SoLContent.get_content(postFrameList=postFrameList)

            post_serializer = SolPostSerializer(solContents, many=True, context={'request': request})
            
            return APIResponse(
                data={
                    'users': [],  # Hashtag 搜尋不返回使用者
                    'posts': post_serializer.data
                },
                message="根據Hashtag搜尋結果"
            )
        else:
            # 先嘗試查找用戶
            users = CustomUser.search_users(query)
            
            if users.exists():
                # 序列化找到的用戶
                user_serializer = UserDetailSearchSerializer(users, many=True)
                
                # 獲取這些用戶的貼文
                user_ids = list(users.values_list('id', flat=True))
                postFrameList = PostFrame.get_postFrames(userList=user_ids)
                solContents = SoLContent.get_content(postFrameList=postFrameList)

                post_serializer = SolPostSerializer(solContents, many=True, context={'request': request})
                
                return APIResponse(
                    data={
                        'users': user_serializer.data,  # 返回相關使用者
                        'posts': post_serializer.data   # 返回這些使用者的貼文
                    },
                    message="用戶及其貼文搜尋結果"
                )
            else:
                # 若找不到用戶，則從貼文內容中搜尋
                contents = SoLContent.get_content(query=query)
                postFrameList = PostFrame.get_postFrames(idList=contents.values_list('postFrame_id', flat=True))
                solContents = SoLContent.get_content(postFrameList=postFrameList)

                post_serializer = SolPostSerializer(solContents, many=True, context={'request': request})
                
                return APIResponse(
                    data={
                        'users': [],  # 沒有相關使用者
                        'posts': post_serializer.data
                    },
                    message="根據貼文內容搜尋結果"
                )

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
            hashtags = PostHashtag.get_hashtags(query=tag_query)
            
            for tag in hashtags:
                suggestions.append({
                    'type': 'hashtag',
                    'value': f'#{tag}'
                })
        else:
            # 建議用戶
            users = CustomUser.search_users(query)  # 限制最多5個建議
            
            for user in users:
                suggestions.append({
                    'type': 'user',
                    'value': UserBasicSerializer(user).data
                })
                
            # 如果建議不足5個，添加部分hashtag建議
            if len(suggestions) < 5:
                hashtags = PostHashtag.get_hashtags(query=query, count=5-len(suggestions))
                
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
        try:
            user: CustomUser = request.user
            content = request.data.get('content')
            uploaded_image_files = request.FILES.getlist('images')
            hashtag_data = request.data.get('hashtags')
            pet_ids = request.data.get('pet_ids')
            
            #Create PostFrame
            postFrame = PostFrame.create(user=user)

            #Create SoLContent
            solContent = SoLContent.create(
                postFrame=postFrame,
                content_text=content
            )

            #Create Post Hashtag References
            hashtags = DataHandler().parse_hashtags(content, hashtag_data)
            for tag in hashtags:
                PostHashtag.create(postFrame=postFrame, tag=tag)
            
            #Create Post Pet References
            pets = DataHandler.parse_pets(pet_ids=pet_ids)
            for pet in pets:
                PostPets.create(postFrame=postFrame, pet=pet) 
            
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
            serializer = PostFrameSerializer(postFrame, context={'request': request})
            
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
    
    @log_queries
    def get_queryset(self):
        user_id = self.kwargs.get('pk')
        
        # 檢查用戶是否存在
        user = CustomUser.get_user(user_id)
        
        # 按創建時間降序獲取該用戶的所有貼文
        posts = SoLContent.get_content(user=user)

        return SolPostSerializer(posts, many=True)
    
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