from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
import re

from google.cloud import vision
from google.oauth2 import service_account
from rest_framework.permissions import AllowAny, IsAuthenticated
from utils.firebase_service import FirebaseStorageService
import os
from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from feeds.models import Feed, FeedReview, FeedErrorReport, UserFeedMark, UserFeed
from feeds.serializers import FeedReviewSerializer, FeedErrorReportSerializer, UserFeedMarkSerializer

NUTRIENT_KEYWORDS = {
    'protein': ['protein', '蛋白', '粗蛋白'],
    'fat': ['fat', '脂肪', '粗脂肪'],
    'carbohydrate': ['carbohydrate', 'carb', '碳水', '碳水化合物', '纖維', '粗纖維'],
    'calcium': ['calcium', '鈣'],
    'phosphorus': ['phosphorus', '磷'],
    'magnesium': ['magnesium', '鎂'],
    'sodium': ['sodium', '鈉']
}

class FeedOCRView(APIView):
    permission_classes = [AllowAny]  
    parser_classes = (MultiPartParser, FormParser)

    @swagger_auto_schema(
        operation_description="上傳飼料包裝圖片，擷取營養標籤資訊（protein, fat 等）",
        manual_parameters=[
            openapi.Parameter(
                name="image",
                in_=openapi.IN_FORM,
                type=openapi.TYPE_FILE,
                required=True,
                description="上傳飼料背面圖片"
            )
        ],
        responses={200: openapi.Response('成功', schema=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'extracted_nutrients': openapi.Schema(type=openapi.TYPE_OBJECT)
            }
        ))}
    )
    def post(self, request, *args, **kwargs):
        credentials_path = os.path.join(settings.BASE_DIR, 'feeds', 'ai-project-454107-a1e8b881803e.json')

        uploaded_image = request.FILES.get('image')
        if not uploaded_image:
            return Response({'error': 'No image uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

        credentials = service_account.Credentials.from_service_account_file(credentials_path)
        client = vision.ImageAnnotatorClient(credentials=credentials)

        content = uploaded_image.read()
        image = vision.Image(content=content)

        response = client.text_detection(image=image)
        texts = response.text_annotations

        if response.error.message:
            return Response({'error': response.error.message}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        elif not texts:
            return Response({'extracted_nutrients': {}}, status=status.HTTP_200_OK)

        raw_text = texts[0].description
        extracted = self.extract_nutrients(raw_text)
        return Response({
            'raw_text': raw_text,
            'extracted_nutrients': extracted
        }, status=status.HTTP_200_OK)


    def extract_nutrients(self, text):
        # 整理文字
        text = text.replace('\n', ' ')
        text = re.sub(r'\s+', ' ', text)
        result = {}

        for field, keywords in NUTRIENT_KEYWORDS.items():
            matched = False
            for keyword in keywords:
                # 允許前後有雜訊，數字後面可能有 %
                pattern = rf"{keyword}.*?([\d\.]+)\s*%?"
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    try:
                        result[field] = float(match.group(1))
                        matched = True
                        break
                    except ValueError:
                        continue
            if not matched:
                result[field] = None  # 沒找到也標註
        return result


class FeedReviewView(APIView):
    """飼料審核視圖"""
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_description="審核飼料（每個用戶只能審核一次）",
        manual_parameters=[
            openapi.Parameter(
                name="feed_id",
                in_=openapi.IN_PATH,
                type=openapi.TYPE_INTEGER,
                required=True,
                description="飼料ID"
            )
        ],
        responses={
            200: openapi.Response('審核成功'),
            400: openapi.Response('您已經審核過此飼料'),
            404: openapi.Response('飼料不存在')
        }
    )
    def post(self, request, feed_id):
        try:
            feed = Feed.objects.get(id=feed_id)
        except Feed.DoesNotExist:
            return Response({'error': '飼料不存在'}, status=status.HTTP_404_NOT_FOUND)
        
        # 檢查是否已經審核過
        if FeedReview.objects.filter(feed=feed, reviewer=request.user).exists():
            return Response({'error': '您已經審核過此飼料'}, status=status.HTTP_400_BAD_REQUEST)
        
        with transaction.atomic():
            # 創建審核記錄
            review = FeedReview.objects.create(
                feed=feed,
                reviewer=request.user
            )
            
            # 更新飼料審核計數
            feed.review_count = F('review_count') + 1
            feed.save()
            feed.refresh_from_db()
            
            # 如果達到5人審核，標記為已驗證
            if feed.review_count >= 5 and not feed.is_verified:
                feed.is_verified = True
                feed.save()
        
        return Response({
            'message': '審核成功',
            'review_count': feed.review_count,
            'is_verified': feed.is_verified
        }, status=status.HTTP_200_OK)
    
    @swagger_auto_schema(
        operation_description="獲取飼料的審核記錄",
        manual_parameters=[
            openapi.Parameter(
                name="feed_id",
                in_=openapi.IN_PATH,
                type=openapi.TYPE_INTEGER,
                required=True,
                description="飼料ID"
            )
        ]
    )
    def get(self, request, feed_id):
        try:
            feed = Feed.objects.get(id=feed_id)
        except Feed.DoesNotExist:
            return Response({'error': '飼料不存在'}, status=status.HTTP_404_NOT_FOUND)
        
        reviews = FeedReview.objects.filter(feed=feed).order_by('-reviewed_at')
        serializer = FeedReviewSerializer(reviews, many=True)
        
        return Response({
            'feed_id': feed_id,
            'review_count': feed.review_count,
            'is_verified': feed.is_verified,
            'reviews': serializer.data
        }, status=status.HTTP_200_OK)


class FeedErrorReportView(APIView):
    """飼料錯誤回報視圖"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """測試端點是否可訪問"""
        return Response({'message': '錯誤回報 API 端點正常運作'}, status=status.HTTP_200_OK)
    
    @swagger_auto_schema(
        operation_description="回報飼料錯誤",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['feed_id', 'error_type', 'description'],
            properties={
                'feed_id': openapi.Schema(type=openapi.TYPE_INTEGER, description='飼料ID'),
                'error_type': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    enum=['name', 'brand', 'nutrition', 'price', 'image', 'multiple', 'other'],
                    description='錯誤類型'
                ),
                'description': openapi.Schema(type=openapi.TYPE_STRING, description='錯誤描述'),
                'original_data': openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    description='原始錯誤資料',
                    properties={
                        'name': openapi.Schema(type=openapi.TYPE_STRING),
                        'brand': openapi.Schema(type=openapi.TYPE_STRING),
                        'price': openapi.Schema(type=openapi.TYPE_NUMBER),
                        'protein': openapi.Schema(type=openapi.TYPE_NUMBER),
                        'fat': openapi.Schema(type=openapi.TYPE_NUMBER),
                        'carbohydrate': openapi.Schema(type=openapi.TYPE_NUMBER),
                        'calcium': openapi.Schema(type=openapi.TYPE_NUMBER),
                        'phosphorus': openapi.Schema(type=openapi.TYPE_NUMBER),
                        'magnesium': openapi.Schema(type=openapi.TYPE_NUMBER),
                        'sodium': openapi.Schema(type=openapi.TYPE_NUMBER),
                    }
                ),
                'corrected_data': openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    description='使用者建議的正確資料',
                    properties={
                        'name': openapi.Schema(type=openapi.TYPE_STRING),
                        'brand': openapi.Schema(type=openapi.TYPE_STRING),
                        'price': openapi.Schema(type=openapi.TYPE_NUMBER),
                        'protein': openapi.Schema(type=openapi.TYPE_NUMBER),
                        'fat': openapi.Schema(type=openapi.TYPE_NUMBER),
                        'carbohydrate': openapi.Schema(type=openapi.TYPE_NUMBER),
                        'calcium': openapi.Schema(type=openapi.TYPE_NUMBER),
                        'phosphorus': openapi.Schema(type=openapi.TYPE_NUMBER),
                        'magnesium': openapi.Schema(type=openapi.TYPE_NUMBER),
                        'sodium': openapi.Schema(type=openapi.TYPE_NUMBER),
                    }
                )
            }
        ),
        responses={
            201: openapi.Response('回報成功'),
            404: openapi.Response('飼料不存在')
        }
    )
    def post(self, request):
        feed_id = request.data.get('feed_id')
        
        if not feed_id:
            return Response({'error': '請提供飼料ID'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            feed = Feed.objects.get(id=feed_id)
        except Feed.DoesNotExist:
            return Response({'error': '飼料不存在'}, status=status.HTTP_404_NOT_FOUND)
        
        # 準備原始資料
        original_data = {}
        corrected_data = request.data.get('corrected_data', {})
        
        # 根據錯誤類型和提供的修正資料，自動收集原始資料
        if corrected_data:
            for field in ['name', 'brand', 'price', 'protein', 'fat', 'carbohydrate', 
                         'calcium', 'phosphorus', 'magnesium', 'sodium']:
                if field in corrected_data:
                    original_data[field] = getattr(feed, field)
        
        # 如果使用者有提供 original_data，則合併
        user_original_data = request.data.get('original_data', {})
        original_data.update(user_original_data)
        
        serializer = FeedErrorReportSerializer(data={
            'feed': feed_id,
            'error_type': request.data.get('error_type'),
            'description': request.data.get('description'),
            'original_data': original_data if original_data else None,
            'corrected_data': corrected_data if corrected_data else None
        })
        
        if serializer.is_valid():
            serializer.save(reporter=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @swagger_auto_schema(
        operation_description="獲取飼料的錯誤回報記錄",
        manual_parameters=[
            openapi.Parameter(
                name="feed_id",
                in_=openapi.IN_QUERY,
                type=openapi.TYPE_INTEGER,
                required=False,
                description="飼料ID（不提供則返回所有回報）"
            ),
            openapi.Parameter(
                name="is_resolved",
                in_=openapi.IN_QUERY,
                type=openapi.TYPE_BOOLEAN,
                required=False,
                description="是否已處理"
            )
        ]
    )
    def get(self, request):
        queryset = FeedErrorReport.objects.all()
        
        feed_id = request.query_params.get('feed_id')
        if feed_id:
            queryset = queryset.filter(feed_id=feed_id)
        
        is_resolved = request.query_params.get('is_resolved')
        if is_resolved is not None:
            queryset = queryset.filter(is_resolved=is_resolved.lower() == 'true')
        
        queryset = queryset.order_by('-reported_at')
        serializer = FeedErrorReportSerializer(queryset, many=True)
        
        return Response(serializer.data, status=status.HTTP_200_OK)


class UserFeedMarkView(APIView):
    """使用者飼料標記視圖"""
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_description="切換飼料標記狀態",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['feed_id'],
            properties={
                'feed_id': openapi.Schema(type=openapi.TYPE_INTEGER, description='飼料ID')
            }
        ),
        responses={
            200: openapi.Response('標記狀態切換成功', schema=openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    'marked': openapi.Schema(type=openapi.TYPE_BOOLEAN),
                    'message': openapi.Schema(type=openapi.TYPE_STRING)
                }
            )),
            404: openapi.Response('飼料不存在')
        }
    )
    def post(self, request):
        feed_id = request.data.get('feed_id')
        try:
            feed = Feed.objects.get(id=feed_id)
        except Feed.DoesNotExist:
            return Response({'error': '飼料不存在'}, status=status.HTTP_404_NOT_FOUND)
        
        # 檢查是否已經標記
        mark, created = UserFeedMark.objects.get_or_create(
            user=request.user,
            feed=feed
        )
        
        if not created:
            # 如果已存在，則刪除標記
            mark.delete()
            marked = False
            message = '已取消標記'
        else:
            marked = True
            message = '已標記飼料'
        
        return Response({
            'marked': marked,
            'message': message
        }, status=status.HTTP_200_OK)
    
    @swagger_auto_schema(
        operation_description="獲取使用者標記的飼料清單",
        responses={
            200: UserFeedMarkSerializer(many=True)
        }
    )
    def get(self, request):
        marks = UserFeedMark.objects.filter(user=request.user).order_by('-created_at')
        serializer = UserFeedMarkSerializer(marks, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class MyMarkedFeedsView(APIView):
    """我的精選飼料 API"""
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_description="獲取使用者標記的精選飼料清單",
        responses={
            200: openapi.Response('成功', schema=openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    'data': openapi.Schema(type=openapi.TYPE_ARRAY, items=openapi.Schema(type=openapi.TYPE_OBJECT)),
                    'message': openapi.Schema(type=openapi.TYPE_STRING)
                }
            ))
        }
    )
    def get(self, request):
        marks = UserFeedMark.objects.filter(user=request.user).select_related('feed').order_by('-created_at')
        
        if not marks.exists():
            return Response({
                'data': [],
                'message': '暫無精選飼料資料'
            }, status=status.HTTP_200_OK)
        
        serializer = UserFeedMarkSerializer(marks, many=True)
        return Response({
            'data': serializer.data,
            'message': f'共 {marks.count()} 筆精選飼料'
        }, status=status.HTTP_200_OK)


class MyMarkedFeedsPreviewView(APIView):
    """我的精選飼料預覽 API（可自訂數量限制）"""
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_description="獲取使用者標記的精選飼料預覽清單",
        manual_parameters=[
            openapi.Parameter(
                name="limit",
                in_=openapi.IN_QUERY,
                type=openapi.TYPE_INTEGER,
                required=False,
                description="限制返回數量，默認為3"
            )
        ],
        responses={
            200: openapi.Response('成功', schema=openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    'data': openapi.Schema(type=openapi.TYPE_ARRAY, items=openapi.Schema(type=openapi.TYPE_OBJECT)),
                    'message': openapi.Schema(type=openapi.TYPE_STRING),
                    'total_count': openapi.Schema(type=openapi.TYPE_INTEGER),
                    'has_more': openapi.Schema(type=openapi.TYPE_BOOLEAN)
                }
            ))
        }
    )
    def get(self, request):
        limit = int(request.query_params.get('limit', 3))
        marks = UserFeedMark.objects.filter(user=request.user).select_related('feed').order_by('-created_at')
        total_count = marks.count()
        
        if total_count == 0:
            return Response({
                'data': [],
                'message': '暫無精選飼料資料',
                'total_count': 0,
                'has_more': False
            }, status=status.HTTP_200_OK)
        
        # 根據limit參數限制數量
        preview_marks = marks[:limit]
        serializer = UserFeedMarkSerializer(preview_marks, many=True)
        
        return Response({
            'data': serializer.data,
            'message': f'顯示 {len(preview_marks)} 筆，共 {total_count} 筆精選飼料',
            'total_count': total_count,
            'has_more': total_count > limit
        }, status=status.HTTP_200_OK)


class RecentlyUsedFeedsView(APIView):
    """上次使用飼料 API（基於 UserFeed 表）"""
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_description="獲取使用者最近使用的飼料清單（基於 UserFeed 表的 last_used_at）",
        manual_parameters=[
            openapi.Parameter(
                name="limit",
                in_=openapi.IN_QUERY,
                type=openapi.TYPE_INTEGER,
                required=False,
                description="限制返回數量，默認為10"
            )
        ],
        responses={
            200: openapi.Response('成功', schema=openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    'data': openapi.Schema(type=openapi.TYPE_ARRAY, items=openapi.Schema(type=openapi.TYPE_OBJECT)),
                    'message': openapi.Schema(type=openapi.TYPE_STRING)
                }
            ))
        }
    )
    def get(self, request):
        limit = int(request.query_params.get('limit', 10))
        
        # 從 UserFeed 表中獲取最近使用的飼料，按 last_used_at 排序
        recent_feeds = UserFeed.objects.filter(
            user=request.user
        ).select_related('feed', 'pet').order_by('-last_used_at')[:limit]
        
        if not recent_feeds.exists():
            return Response({
                'data': [],
                'message': '暫無使用記錄'
            }, status=status.HTTP_200_OK)
        
        # 檢查每個飼料是否被標記
        marked_feed_ids = set(
            UserFeedMark.objects.filter(
                user=request.user,
                feed__in=[uf.feed for uf in recent_feeds]
            ).values_list('feed_id', flat=True)
        )
        
        # 組裝數據
        data = []
        for user_feed in recent_feeds:
            feed_data = {
                'id': user_feed.feed.id,
                'name': user_feed.feed.name,
                'brand': user_feed.feed.brand,
                'pet_type': user_feed.feed.pet_type,
                'protein': user_feed.feed.protein,
                'fat': user_feed.feed.fat,
                'carbohydrate': user_feed.feed.carbohydrate,
                'calcium': user_feed.feed.calcium,
                'phosphorus': user_feed.feed.phosphorus,
                'magnesium': user_feed.feed.magnesium,
                'sodium': user_feed.feed.sodium,
                'price': user_feed.feed.price,
                'review_count': user_feed.feed.review_count,
                'is_verified': user_feed.feed.is_verified,
                'front_image_url': None,
                'nutrition_image_url': None,
                'created_at': user_feed.feed.created_at,
                'updated_at': user_feed.feed.updated_at,
                'created_by': user_feed.feed.created_by.username if user_feed.feed.created_by else None,
                'created_by_name': user_feed.feed.created_by.username if user_feed.feed.created_by else None,
                # UserFeed 相關資訊
                'usage_count': user_feed.usage_count,
                'last_used_at': user_feed.last_used_at,
                'pet_name': user_feed.pet.pet_name if user_feed.pet else None,
                'pet_id': user_feed.pet.id if user_feed.pet else None,
                # 標記狀態
                'is_marked': user_feed.feed.id in marked_feed_ids
            }
            
            # 獲取圖片 URL
            front_image = user_feed.feed.feed_images.filter(image_type='front').first()
            if front_image:
                feed_data['front_image_url'] = front_image.firebase_url
                
            nutrition_image = user_feed.feed.feed_images.filter(image_type='nutrition').first()
            if nutrition_image:
                feed_data['nutrition_image_url'] = nutrition_image.firebase_url
            
            data.append(feed_data)
        
        return Response({
            'data': data,
            'message': f'共 {len(data)} 筆使用記錄'
        }, status=status.HTTP_200_OK)


class AllFeedsView(APIView):
    """所有飼料 API"""
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_description="獲取所有已驗證的飼料清單",
        manual_parameters=[
            openapi.Parameter(
                name="pet_type",
                in_=openapi.IN_QUERY,
                type=openapi.TYPE_STRING,
                required=False,
                description="寵物類型篩選 (cat/dog)"
            ),
            openapi.Parameter(
                name="search",
                in_=openapi.IN_QUERY,
                type=openapi.TYPE_STRING,
                required=False,
                description="搜尋飼料名稱或品牌"
            ),
            openapi.Parameter(
                name="limit",
                in_=openapi.IN_QUERY,
                type=openapi.TYPE_INTEGER,
                required=False,
                description="限制返回數量，默認為50"
            )
        ],
        responses={
            200: openapi.Response('成功', schema=openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    'data': openapi.Schema(type=openapi.TYPE_ARRAY, items=openapi.Schema(type=openapi.TYPE_OBJECT)),
                    'message': openapi.Schema(type=openapi.TYPE_STRING)
                }
            ))
        }
    )
    def get(self, request):
        pet_type = request.query_params.get('pet_type')
        search = request.query_params.get('search', '').strip()
        limit = int(request.query_params.get('limit', 50))
        
        # 顯示所有飼料（不限制驗證狀態）
        queryset = Feed.objects.all().order_by('-created_at')
        
        # 寵物類型篩選
        if pet_type in ['cat', 'dog']:
            queryset = queryset.filter(pet_type=pet_type)
        
        # 搜尋功能
        if search:
            from django.db import models
            queryset = queryset.filter(
                models.Q(name__icontains=search) | 
                models.Q(brand__icontains=search)
            )
        
        # 限制數量
        feeds = queryset[:limit]
        
        if not feeds.exists():
            return Response({
                'data': [],
                'message': '暫無飼料資料'
            }, status=status.HTTP_200_OK)
        
        # 檢查每個飼料是否被當前使用者標記
        marked_feed_ids = set(
            UserFeedMark.objects.filter(
                user=request.user,
                feed__in=feeds
            ).values_list('feed_id', flat=True)
        )
        
        # 組裝數據
        data = []
        for feed in feeds:
            feed_data = {
                'id': feed.id,
                'name': feed.name,
                'brand': feed.brand,
                'pet_type': feed.pet_type,
                'protein': feed.protein,
                'fat': feed.fat,
                'carbohydrate': feed.carbohydrate,
                'calcium': feed.calcium,
                'phosphorus': feed.phosphorus,
                'magnesium': feed.magnesium,
                'sodium': feed.sodium,
                'price': feed.price,
                'review_count': feed.review_count,
                'is_verified': feed.is_verified,
                'front_image_url': None,
                'nutrition_image_url': None,
                'created_at': feed.created_at,
                'updated_at': feed.updated_at,
                'created_by': feed.created_by.id if feed.created_by else None,
                'created_by_id': feed.created_by.id if feed.created_by else None,
                'created_by_name': feed.created_by.username if feed.created_by else None,
                # 標記狀態
                'is_marked': feed.id in marked_feed_ids
            }
            
            # 獲取圖片 URL
            front_image = feed.feed_images.filter(image_type='front').first()
            if front_image:
                feed_data['front_image_url'] = front_image.firebase_url
                
            nutrition_image = feed.feed_images.filter(image_type='nutrition').first()
            if nutrition_image:
                feed_data['nutrition_image_url'] = nutrition_image.firebase_url
            
            data.append(feed_data)
        
        return Response({
            'data': data,
            'message': f'共 {len(data)} 筆飼料資料'
        }, status=status.HTTP_200_OK)


class AllFeedsPreviewView(APIView):
    """所有飼料預覽 API（可自訂數量限制）"""
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_description="獲取所有飼料預覽清單",
        manual_parameters=[
            openapi.Parameter(
                name="limit",
                in_=openapi.IN_QUERY,
                type=openapi.TYPE_INTEGER,
                required=False,
                description="限制返回數量，默認為3"
            )
        ],
        responses={
            200: openapi.Response('成功', schema=openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    'data': openapi.Schema(type=openapi.TYPE_ARRAY, items=openapi.Schema(type=openapi.TYPE_OBJECT)),
                    'message': openapi.Schema(type=openapi.TYPE_STRING),
                    'total_count': openapi.Schema(type=openapi.TYPE_INTEGER),
                    'has_more': openapi.Schema(type=openapi.TYPE_BOOLEAN)
                }
            ))
        }
    )
    def get(self, request):
        limit = int(request.query_params.get('limit', 3))
        # 顯示所有飼料（不限制驗證狀態）
        queryset = Feed.objects.all().order_by('-created_at')
        total_count = queryset.count()
        
        if total_count == 0:
            return Response({
                'data': [],
                'message': '暫無飼料資料',
                'total_count': 0,
                'has_more': False
            }, status=status.HTTP_200_OK)
        
        # 根據limit參數限制數量
        feeds = queryset[:limit]
        
        # 檢查每個飼料是否被當前使用者標記
        marked_feed_ids = set(
            UserFeedMark.objects.filter(
                user=request.user,
                feed__in=feeds
            ).values_list('feed_id', flat=True)
        )
        
        # 組裝數據
        data = []
        for feed in feeds:
            feed_data = {
                'id': feed.id,
                'name': feed.name,
                'brand': feed.brand,
                'pet_type': feed.pet_type,
                'protein': feed.protein,
                'fat': feed.fat,
                'carbohydrate': feed.carbohydrate,
                'calcium': feed.calcium,
                'phosphorus': feed.phosphorus,
                'magnesium': feed.magnesium,
                'sodium': feed.sodium,
                'price': feed.price,
                'review_count': feed.review_count,
                'is_verified': feed.is_verified,
                'front_image_url': None,
                'nutrition_image_url': None,
                'created_at': feed.created_at,
                'updated_at': feed.updated_at,
                'created_by': feed.created_by.id if feed.created_by else None,
                'created_by_id': feed.created_by.id if feed.created_by else None,
                'created_by_name': feed.created_by.username if feed.created_by else None,
                # 標記狀態
                'is_marked': feed.id in marked_feed_ids
            }
            
            # 獲取圖片 URL
            front_image = feed.feed_images.filter(image_type='front').first()
            if front_image:
                feed_data['front_image_url'] = front_image.firebase_url
                
            nutrition_image = feed.feed_images.filter(image_type='nutrition').first()
            if nutrition_image:
                feed_data['nutrition_image_url'] = nutrition_image.firebase_url
            
            data.append(feed_data)
        
        return Response({
            'data': data,
            'message': f'顯示 {len(data)} 筆，共 {total_count} 筆飼料資料',
            'total_count': total_count,
            'has_more': total_count > limit
        }, status=status.HTTP_200_OK)


class CheckUserReviewView(APIView):
    """檢查使用者是否已審核過特定飼料或提交過錯誤回報"""
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_description="檢查使用者是否已審核過指定飼料或提交過錯誤回報",
        manual_parameters=[
            openapi.Parameter(
                name="feed_id",
                in_=openapi.IN_PATH,
                type=openapi.TYPE_INTEGER,
                required=True,
                description="飼料ID"
            )
        ],
        responses={
            200: openapi.Response('檢查結果', schema=openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    'has_reviewed': openapi.Schema(type=openapi.TYPE_BOOLEAN),
                    'has_reported_error': openapi.Schema(type=openapi.TYPE_BOOLEAN),
                    'can_use_feed': openapi.Schema(type=openapi.TYPE_BOOLEAN),
                    'message': openapi.Schema(type=openapi.TYPE_STRING)
                }
            )),
            404: openapi.Response('飼料不存在')
        }
    )
    def get(self, request, feed_id):
        try:
            feed = Feed.objects.get(id=feed_id)
        except Feed.DoesNotExist:
            return Response({'error': '飼料不存在'}, status=status.HTTP_404_NOT_FOUND)
        
        # 檢查使用者是否已審核過此飼料
        has_reviewed = FeedReview.objects.filter(
            feed=feed, 
            reviewer=request.user
        ).exists()
        
        # 檢查使用者是否已提交過錯誤回報
        has_reported_error = FeedErrorReport.objects.filter(
            feed=feed,
            reporter=request.user
        ).exists()
        
        # 使用者可以使用飼料的條件：已審核過 OR 已提交錯誤回報 OR 飼料已驗證
        can_use_feed = has_reviewed or has_reported_error or feed.is_verified
        
        # 決定訊息內容
        if has_reviewed:
            message = '已審核過此飼料'
        elif has_reported_error:
            message = '已回報過此飼料錯誤'
        elif feed.is_verified:
            message = '此飼料已通過驗證'
        else:
            message = '尚未審核或回報此飼料'
        
        return Response({
            'has_reviewed': has_reviewed,
            'has_reported_error': has_reported_error,
            'can_use_feed': can_use_feed,
            'message': message
        }, status=status.HTTP_200_OK)


class FeedDetailView(APIView):
    """飼料詳情 API"""
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_description="獲取飼料詳細資訊",
        manual_parameters=[
            openapi.Parameter(
                name="feed_id",
                in_=openapi.IN_PATH,
                type=openapi.TYPE_INTEGER,
                required=True,
                description="飼料ID"
            )
        ],
        responses={
            200: openapi.Response('成功', schema=openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    'id': openapi.Schema(type=openapi.TYPE_INTEGER),
                    'name': openapi.Schema(type=openapi.TYPE_STRING),
                    'brand': openapi.Schema(type=openapi.TYPE_STRING),
                    'pet_type': openapi.Schema(type=openapi.TYPE_STRING),
                    'protein': openapi.Schema(type=openapi.TYPE_NUMBER),
                    'fat': openapi.Schema(type=openapi.TYPE_NUMBER),
                    'carbohydrate': openapi.Schema(type=openapi.TYPE_NUMBER),
                    'calcium': openapi.Schema(type=openapi.TYPE_NUMBER),
                    'phosphorus': openapi.Schema(type=openapi.TYPE_NUMBER),
                    'magnesium': openapi.Schema(type=openapi.TYPE_NUMBER),
                    'sodium': openapi.Schema(type=openapi.TYPE_NUMBER),
                    'price': openapi.Schema(type=openapi.TYPE_NUMBER),
                    'is_verified': openapi.Schema(type=openapi.TYPE_BOOLEAN),
                    'review_count': openapi.Schema(type=openapi.TYPE_INTEGER),
                    'is_marked': openapi.Schema(type=openapi.TYPE_BOOLEAN),
                    'front_image_url': openapi.Schema(type=openapi.TYPE_STRING),
                    'nutrition_image_url': openapi.Schema(type=openapi.TYPE_STRING),
                    'created_by': openapi.Schema(type=openapi.TYPE_STRING),
                    'created_at': openapi.Schema(type=openapi.TYPE_STRING),
                    'updated_at': openapi.Schema(type=openapi.TYPE_STRING),
                }
            )),
            404: openapi.Response('飼料不存在')
        }
    )
    def get(self, request, feed_id):
        try:
            feed = Feed.objects.get(id=feed_id)
        except Feed.DoesNotExist:
            return Response({'error': '飼料不存在'}, status=status.HTTP_404_NOT_FOUND)
        
        # 使用 FeedSerializer 來序列化資料
        from feeds.serializers import FeedSerializer
        serializer = FeedSerializer(feed)
        feed_data = serializer.data
        
        # 檢查是否被標記
        is_marked = UserFeedMark.objects.filter(
            user=request.user,
            feed=feed
        ).exists()
        
        # 添加額外的欄位
        feed_data['is_marked'] = is_marked
        
        return Response(feed_data, status=status.HTTP_200_OK)


class FeedSearchView(APIView):
    """飼料搜尋 API"""
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_description="搜尋飼料（支援名稱和品牌搜尋）",
        manual_parameters=[
            openapi.Parameter(
                name="q",
                in_=openapi.IN_QUERY,
                type=openapi.TYPE_STRING,
                required=True,
                description="搜尋關鍵字（將搜尋飼料名稱和品牌）"
            ),
            openapi.Parameter(
                name="pet_type",
                in_=openapi.IN_QUERY,
                type=openapi.TYPE_STRING,
                required=False,
                description="寵物類型篩選 (cat/dog)"
            ),
            openapi.Parameter(
                name="limit",
                in_=openapi.IN_QUERY,
                type=openapi.TYPE_INTEGER,
                required=False,
                description="限制返回數量，默認為50"
            )
        ],
        responses={
            200: openapi.Response('成功', schema=openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    'data': openapi.Schema(type=openapi.TYPE_ARRAY, items=openapi.Schema(type=openapi.TYPE_OBJECT)),
                    'message': openapi.Schema(type=openapi.TYPE_STRING),
                    'query': openapi.Schema(type=openapi.TYPE_STRING),
                    'total_count': openapi.Schema(type=openapi.TYPE_INTEGER)
                }
            ))
        }
    )
    def get(self, request):
        query = request.query_params.get('q', '').strip()
        pet_type = request.query_params.get('pet_type')
        limit = int(request.query_params.get('limit', 50))
        
        if not query:
            return Response({
                'data': [],
                'message': '請輸入搜尋關鍵字',
                'query': query,
                'total_count': 0
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 搜尋飼料名稱和品牌
        from django.db import models
        queryset = Feed.objects.filter(
            models.Q(name__icontains=query) | 
            models.Q(brand__icontains=query)
        ).order_by('-created_at')
        
        # 寵物類型篩選
        if pet_type in ['cat', 'dog']:
            queryset = queryset.filter(pet_type=pet_type)
        
        total_count = queryset.count()
        
        # 限制數量
        feeds = queryset[:limit]
        
        if not feeds.exists():
            return Response({
                'data': [],
                'message': f'找不到與「{query}」相關的飼料',
                'query': query,
                'total_count': 0
            }, status=status.HTTP_200_OK)
        
        # 檢查每個飼料是否被當前使用者標記
        marked_feed_ids = set(
            UserFeedMark.objects.filter(
                user=request.user,
                feed__in=feeds
            ).values_list('feed_id', flat=True)
        )
        
        # 組裝數據
        data = []
        for feed in feeds:
            feed_data = {
                'id': feed.id,
                'name': feed.name,
                'brand': feed.brand,
                'pet_type': feed.pet_type,
                'protein': feed.protein,
                'fat': feed.fat,
                'carbohydrate': feed.carbohydrate,
                'calcium': feed.calcium,
                'phosphorus': feed.phosphorus,
                'magnesium': feed.magnesium,
                'sodium': feed.sodium,
                'price': feed.price,
                'review_count': feed.review_count,
                'is_verified': feed.is_verified,
                'front_image_url': None,
                'nutrition_image_url': None,
                'created_at': feed.created_at,
                'updated_at': feed.updated_at,
                'created_by': feed.created_by.id if feed.created_by else None,
                'created_by_id': feed.created_by.id if feed.created_by else None,
                'created_by_name': feed.created_by.username if feed.created_by else None,
                # 標記狀態
                'is_marked': feed.id in marked_feed_ids
            }
            
            # 獲取圖片 URL
            front_image = feed.feed_images.filter(image_type='front').first()
            if front_image:
                feed_data['front_image_url'] = front_image.firebase_url
                
            nutrition_image = feed.feed_images.filter(image_type='nutrition').first()
            if nutrition_image:
                feed_data['nutrition_image_url'] = nutrition_image.firebase_url
            
            data.append(feed_data)
        
        return Response({
            'data': data,
            'message': f'搜尋「{query}」找到 {len(data)} 筆結果',
            'query': query,
            'total_count': total_count
        }, status=status.HTTP_200_OK)


class UnifiedFeedCreateView(APIView):
    """統一的飼料創建 API - 支援 multipart 和 base64 兩種格式"""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _upload_feed_image_base64(self, feed, image_data, image_type):
        """處理 base64 圖片上傳（來自 Calculator app 的邏輯）"""
        import base64
        import io
        from django.core.files.uploadedfile import InMemoryUploadedFile
        from utils.firebase_service import firebase_storage_service
        from media.models import FeedImage
        import logging
        
        logger = logging.getLogger(__name__)
        
        try:
            # 解析 base64 圖片數據
            if ',' in image_data:
                header, image_data = image_data.split(',', 1)
                if 'data:' in header and ';base64' in header:
                    content_type = header.split('data:')[1].split(';base64')[0]
                else:
                    content_type = 'image/jpeg'
            else:
                content_type = 'image/jpeg'
                
            # 解碼 base64 數據
            image_data = base64.b64decode(image_data)
            
            # 生成檔案名稱
            file_extension = '.jpg'
            if 'png' in content_type:
                file_extension = '.png'
            elif 'gif' in content_type:
                file_extension = '.gif'
            elif 'webp' in content_type:
                file_extension = '.webp'
                
            file_name = f"feed_{image_type}_{feed.id}{file_extension}"
            
            # 建立檔案流
            image_file = io.BytesIO(image_data)
            
            # 建立 Django 檔案物件
            django_file = InMemoryUploadedFile(
                image_file,
                None,
                file_name,
                content_type,
                len(image_data),
                None
            )
            
            # 使用 Firebase Storage 服務上傳圖片
            success, message, firebase_url, firebase_path = firebase_storage_service.upload_feed_photo(
                feed_id=feed.id,
                photo_file=django_file,
                photo_type=image_type,
                pet_type=feed.pet_type
            )
            
            if success:
                # 創建 FeedImage 記錄
                FeedImage.create_or_update(
                    feed=feed,
                    image_type=image_type,
                    firebase_url=firebase_url,
                    firebase_path=firebase_path,
                    original_filename=file_name,
                    content_type=content_type,
                    file_size=len(image_data)
                )
                logger.info(f"飼料圖片 {image_type} 上傳成功: {firebase_url}")
                return True
            else:
                logger.error(f"飼料圖片 {image_type} 上傳失敗: {message}")
                return False
                
        except Exception as e:
            logger.error(f"處理飼料圖片 {image_type} 時出錯: {str(e)}", exc_info=True)
            return False

    def _upload_feed_image_multipart(self, feed, image_file, image_type):
        """處理 multipart 圖片上傳（原 feeds app 的邏輯）"""
        try:
            firebase_service = FirebaseStorageService()
            image_url = firebase_service.upload_feed_image(image_file, feed.id, image_type)
            
            from media.models import FeedImage
            FeedImage.objects.create(
                feed=feed,
                image_type=image_type,
                firebase_url=image_url
            )
            return True
        except Exception as e:
            print(f"上傳 {image_type} 圖片失敗: {e}")
            return False

    @swagger_auto_schema(
        operation_description="統一的飼料創建 API - 支援 multipart 和 base64 兩種格式",
        manual_parameters=[
            openapi.Parameter(
                name="name",
                in_=openapi.IN_FORM,
                type=openapi.TYPE_STRING,
                required=True,
                description="飼料名稱"
            ),
            openapi.Parameter(
                name="brand",
                in_=openapi.IN_FORM,
                type=openapi.TYPE_STRING,
                required=True,
                description="飼料品牌"
            ),
            openapi.Parameter(
                name="pet_type",
                in_=openapi.IN_FORM,
                type=openapi.TYPE_STRING,
                required=True,
                description="寵物類型 (cat/dog)"
            ),
            openapi.Parameter(
                name="price",
                in_=openapi.IN_FORM,
                type=openapi.TYPE_NUMBER,
                required=False,
                description="飼料價格"
            ),
            openapi.Parameter(
                name="pet_id",
                in_=openapi.IN_FORM,
                type=openapi.TYPE_INTEGER,
                required=False,
                description="寵物ID（用於建立 UserFeed 關係）"
            )
        ],
        responses={
            201: openapi.Response('新增成功'),
            200: openapi.Response('匹配到現有飼料'),
            400: openapi.Response('請求資料錯誤')
        }
    )
    def post(self, request):
        try:
            data = request.data
            user = request.user

            def parse_float(value):
                try:
                    return float(value) if value is not None else 0.0
                except (TypeError, ValueError):
                    return 0.0

            # 必要欄位驗證  
            name = data.get("name", "").strip()
            brand = data.get("brand", "").strip()
            pet_type = data.get("pet_type", "cat")
            price = data.get("price", 0)
            
            if not name or not brand:
                return Response({
                    "error": "名稱和品牌為必填欄位"
                }, status=status.HTTP_400_BAD_REQUEST)

            if pet_type not in ['cat', 'dog']:
                return Response({
                    "error": "pet_type 必須是 'cat' 或 'dog'"
                }, status=status.HTTP_400_BAD_REQUEST)

            # 獲取營養成分（支援從 OCR 結果或直接提供）
            protein = parse_float(data.get("protein"))
            fat = parse_float(data.get("fat"))
            carbohydrate = parse_float(data.get("carbohydrate"))
            calcium = parse_float(data.get("calcium"))
            phosphorus = parse_float(data.get("phosphorus"))
            magnesium = parse_float(data.get("magnesium"))
            sodium = parse_float(data.get("sodium"))

            with transaction.atomic():
                # 檢查是否已存在相同營養成分的飼料（智能匹配邏輯）
                existing_feed = Feed.objects.filter(
                    pet_type=pet_type,
                    protein=protein,
                    fat=fat,
                    carbohydrate=carbohydrate,
                    calcium=calcium,
                    phosphorus=phosphorus,
                    magnesium=magnesium,
                    sodium=sodium
                ).first()

                if existing_feed:
                    # 如果飼料已存在，建立 UserFeed 關係（如果提供了 pet_id）
                    pet_id = data.get('pet_id')
                    if pet_id:
                        try:
                            from pets.models import Pet
                            pet = Pet.objects.get(id=pet_id, owner=user)
                            
                            user_feed, created = UserFeed.objects.get_or_create(
                                user=user,
                                feed=existing_feed,
                                pet=pet,
                                defaults={'usage_count': 0}
                            )
                            
                            if not created:
                                user_feed.last_used_at = timezone.now()
                                user_feed.save(update_fields=['last_used_at'])
                        except:
                            pass  # 如果寵物不存在，只返回飼料資訊
                    
                    return Response({
                        "message": "資料庫中已有此飼料，直接幫您匹配",
                        "feed_id": existing_feed.id,
                        "data": {
                            "id": existing_feed.id,
                            "name": existing_feed.name,
                            "brand": existing_feed.brand,
                            "pet_type": existing_feed.pet_type,
                            "protein": existing_feed.protein,
                            "fat": existing_feed.fat,
                            "carbohydrate": existing_feed.carbohydrate,
                            "calcium": existing_feed.calcium,
                            "phosphorus": existing_feed.phosphorus,
                            "magnesium": existing_feed.magnesium,
                            "sodium": existing_feed.sodium,
                            "price": existing_feed.price
                        },
                        "is_existing": True
                    }, status=status.HTTP_200_OK)

                else:
                    # 建立新的共用飼料
                    new_feed = Feed.objects.create(
                        name=name,
                        brand=brand,
                        pet_type=pet_type,
                        protein=protein,
                        fat=fat,
                        carbohydrate=carbohydrate,
                        calcium=calcium,
                        phosphorus=phosphorus,
                        magnesium=magnesium,
                        sodium=sodium,
                        price=price,
                        created_by=user
                    )
                    
                    # 處理圖片上傳 - 支援兩種格式
                    front_image_uploaded = False
                    nutrition_image_uploaded = False
                    
                    # 檢查是否為 base64 格式
                    front_image_b64 = data.get("front_image")
                    nutrition_image_b64 = data.get("nutrition_image")
                    
                    # 檢查是否為 multipart 格式
                    front_image_file = request.FILES.get('front_image')
                    nutrition_image_file = request.FILES.get('nutrition_image')
                    
                    # 處理正面圖片
                    if front_image_b64 and isinstance(front_image_b64, str):
                        front_image_uploaded = self._upload_feed_image_base64(new_feed, front_image_b64, 'front')
                    elif front_image_file:
                        front_image_uploaded = self._upload_feed_image_multipart(new_feed, front_image_file, 'front')
                    
                    # 處理營養標籤圖片
                    if nutrition_image_b64 and isinstance(nutrition_image_b64, str):
                        nutrition_image_uploaded = self._upload_feed_image_base64(new_feed, nutrition_image_b64, 'nutrition')
                    elif nutrition_image_file:
                        nutrition_image_uploaded = self._upload_feed_image_multipart(new_feed, nutrition_image_file, 'nutrition')

                    # 建立 UserFeed 關係（如果提供了 pet_id）
                    pet_id = data.get('pet_id')
                    if pet_id:
                        try:
                            from pets.models import Pet
                            pet = Pet.objects.get(id=pet_id, owner=user)
                            
                            UserFeed.objects.create(
                                user=user,
                                feed=new_feed,
                                pet=pet,
                                usage_count=1
                            )
                        except:
                            pass  # 如果寵物不存在，只返回飼料資訊

                    return Response({
                        "message": "新飼料建立成功",
                        "feed_id": new_feed.id,
                        "data": {
                            "id": new_feed.id,
                            "name": new_feed.name,
                            "brand": new_feed.brand,
                            "pet_type": new_feed.pet_type,
                            "protein": new_feed.protein,
                            "fat": new_feed.fat,
                            "carbohydrate": new_feed.carbohydrate,
                            "calcium": new_feed.calcium,
                            "phosphorus": new_feed.phosphorus,
                            "magnesium": new_feed.magnesium,
                            "sodium": new_feed.sodium,
                            "price": new_feed.price
                        },
                        "is_existing": False
                    }, status=status.HTTP_201_CREATED)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                "error": f"建立飼料時發生錯誤：{str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# 保留原有的 CreateFeedView 作為 multipart 專用的簡化版本
class CreateFeedView(APIView):
    """簡化的飼料創建 API - 僅支援 multipart 格式（向後兼容）"""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    def post(self, request):
        # 直接轉發給統一的 API
        unified_view = UnifiedFeedCreateView()
        unified_view.request = request
        return unified_view.post(request)


class AddFeedToUserView(APIView):
    """將現有飼料加入使用者清單（建立 UserFeed 關係）"""
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_description="將現有的共用飼料加入使用者的飼料清單",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['feed_id', 'pet_id'],
            properties={
                'feed_id': openapi.Schema(type=openapi.TYPE_INTEGER, description='飼料ID'),
                'pet_id': openapi.Schema(type=openapi.TYPE_INTEGER, description='寵物ID')
            }
        ),
        responses={
            200: openapi.Response('加入成功'),
            404: openapi.Response('飼料或寵物不存在')
        }
    )
    def post(self, request):
        feed_id = request.data.get('feed_id')
        pet_id = request.data.get('pet_id')
        user = request.user
        
        if not feed_id:
            return Response({
                "error": "請提供 feed_id"
            }, status=status.HTTP_400_BAD_REQUEST)
            
        if not pet_id:
            return Response({
                "error": "請提供 pet_id"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            feed = Feed.objects.get(id=feed_id)
        except Feed.DoesNotExist:
            return Response({
                "error": "找不到指定的飼料"
            }, status=status.HTTP_404_NOT_FOUND)
            
        # 驗證寵物是否屬於該用戶
        try:
            from pets.models import Pet
            pet = Pet.objects.get(id=pet_id, owner=user)
        except Pet.DoesNotExist:
            return Response({
                "error": "找不到該寵物或您沒有權限"
            }, status=status.HTTP_404_NOT_FOUND)
        
        try:
            user_feed, created = UserFeed.objects.get_or_create(
                user=user,
                feed=feed,
                pet=pet,
                defaults={'usage_count': 0}
            )
            
            if not created:
                # 如果飼料已在清單中，只更新最後使用時間
                user_feed.last_used_at = timezone.now()
                user_feed.save(update_fields=['last_used_at'])
                message = "飼料已在您的清單中"
            else:
                message = "飼料已成功加入您的清單"
            
            from feeds.serializers import UserFeedSerializer
            return Response({
                "message": message,
                "data": UserFeedSerializer(user_feed).data
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                "error": f"加入飼料時發生錯誤：{str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

