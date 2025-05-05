from django.utils import timezone
import random
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from media.models import Image
from pets.models import Pet
from pets.models import IllnessArchive
from feeds.models import * 
import math
import re
import easyocr
from PIL import Image as PilImage
from io import BytesIO
from utils.api_response import APIResponse
from utils.decorators import log_queries
import os
import tempfile
import logging
from django.db import transaction
from django.contrib.contenttypes.models import ContentType
from .serializers import UploadFeedSerializer, NutritionCalculatorRequestSerializer, FeedStatusSerializer, FeedSerializer, PetFeedSerializer, PetFeedCreateSerializer
from .tasks import process_feed_ocr
from django.core.exceptions import ValidationError
from django.http import Http404
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from rest_framework.pagination import StandardResultsSetPagination
from django.db.models import Prefetch
from utils.image_service import ImageService
from utils.throttling import FeedUploadRateThrottle, FeedCalculateRateThrottle, BurstRateThrottle
from utils.error_codes import ErrorCodes

# 配置日誌記錄器
logger = logging.getLogger(__name__)

#建立選擇的寵物資料
class GeneratePetInfoAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @log_queries
    def post(self, request):
        data = request.data
        pet_id = data.get('pet_id')
        edited_info = data.get('edited_info', {})

        if not pet_id:
            return APIResponse(
                message="pet_id is required.",
                code=status.HTTP_400_BAD_REQUEST,
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # 使用 prefetch_related 來預加載相關數據
            pet = Pet.objects.prefetch_related(
                'illness_archives__illnesses__illness'
            ).get(id=pet_id)
        except Pet.DoesNotExist:
            return APIResponse(
                message="Pet not found.",
                code=status.HTTP_404_NOT_FOUND,
                status=status.HTTP_404_NOT_FOUND
            )

        # Step 1: 從 Pet model 取出基本資料
        pet_info = {
            "pet_type": pet.pet_type,
            "pet_name": pet.pet_name,
            "age": pet.age,
            "breed": pet.breed,
            "weight": pet.weight,
            "height": pet.height,
            "pet_stage": pet.pet_stage,
            "predicted_adult_weight": pet.predicted_adult_weight,
        }

        # Step 2: 透過 IllnessArchive 和 ArchiveIllnessRelation 找出疾病
        # 已經預加載數據，所以這裡不會產生額外的查詢
        illness_names = set()
        for archive in pet.illness_archives.all():
            for relation in archive.illnesses.all():
                illness_names.add(relation.illness.illness_name)
        
        pet_info["illnesses"] = list(illness_names)

        # Step 3: 合併 edited_info（使用者修改的資料會覆蓋原本的）
        for key, value in edited_info.items():
            if key in pet_info:
                pet_info[key] = value

        return APIResponse(data=pet_info)

#得到寵物資料和飼料id之後開始計算
class FeedNutritionCalculatorAPIView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [FeedCalculateRateThrottle]
    
    @swagger_auto_schema(
        operation_summary="計算飼料的營養需求",
        operation_description="根據提供的飼料ID和寵物信息，計算每日所需飼料量和營養攝入",
        request_body=NutritionCalculatorRequestSerializer,
        responses={
            200: openapi.Response(
                description="營養計算完成",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'code': openapi.Schema(type=openapi.TYPE_INTEGER, example=200),
                        'message': openapi.Schema(type=openapi.TYPE_STRING, example="營養計算完成"),
                        'data': openapi.Schema(
                            type=openapi.TYPE_OBJECT,
                            properties={
                                'daily_energy_need': openapi.Schema(type=openapi.TYPE_NUMBER, example=1250.45),
                                'feed_energy_per_100g': openapi.Schema(type=openapi.TYPE_NUMBER, example=350.25),
                                'daily_feed_grams': openapi.Schema(type=openapi.TYPE_NUMBER, example=356.73),
                                'daily_nutrition': openapi.Schema(type=openapi.TYPE_OBJECT),
                                'feed_info': openapi.Schema(type=openapi.TYPE_OBJECT),
                            }
                        )
                    }
                )
            ),
            400: openapi.Response(description="請求參數無效"),
            404: openapi.Response(description="飼料不存在")
        }
    )
    @log_queries
    def post(self, request):
        """
        計算飼料的營養需求
        
        根據提供的飼料ID和寵物信息，計算每日所需飼料量和營養攝入
        """
        # 使用序列化器驗證請求參數
        serializer = NutritionCalculatorRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return APIResponse(
                code=400,
                message="請求參數無效",
                data={"errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # 獲取驗證後的數據
        validated_data = serializer.validated_data
        feed_id = validated_data['feed_id']
        pet_info = validated_data['pet_info']
        
        # 檢查飼料是否存在
        try:
            feed = Feed.objects.get(id=feed_id)
            
            # 檢查飼料處理狀態
            if feed.processing_status == 'pending' or feed.processing_status == 'processing':
                return APIResponse(
                    code=202, 
                    message="飼料營養信息正在處理中，請稍後再試",
                    data={
                        "feed_id": feed.id,
                        "name": feed.name,
                        "processing_status": feed.processing_status
                    }
                )
            
            if feed.processing_status == 'failed':
                return APIResponse(
                    code=400, 
                    message="飼料營養信息處理失敗，請重新上傳",
                    data={
                        "feed_id": feed.id,
                        "name": feed.name,
                        "processing_status": feed.processing_status,
                        "error": feed.processing_error
                    }
                )
            
            # 檢查飼料營養數據完整性
            required_nutrients = ['protein', 'fat', 'carbohydrate']
            missing_nutrients = [nutrient for nutrient in required_nutrients 
                              if getattr(feed, nutrient, 0) == 0]
            
            if missing_nutrients:
                return APIResponse(
                    code=400,
                    message="飼料營養數據不完整，無法進行準確計算",
                    data={
                        "feed_id": feed.id,
                        "name": feed.name,
                        "missing_nutrients": missing_nutrients
                    }
                )
                
            # 添加用户最近使用的飼料記錄
            UserFeed.objects.update_or_create(
                user=request.user,
                feed=feed,
                defaults={'last_used': timezone.now()}
            )
            
            # 如果提供了寵物ID，則記錄寵物的飼料使用
            pet_id = pet_info.get('pet_id')
            if pet_id:
                try:
                    pet = Pet.objects.get(id=pet_id, owner=request.user)
                    # 更新寵物的飼料使用記錄
                    PetFeed.objects.update_or_create(
                        pet=pet,
                        feed=feed,
                        defaults={
                            'last_used': timezone.now(),
                            'is_current': True  # 設為當前使用的飼料
                        }
                    )
                except Pet.DoesNotExist:
                    # 寵物不存在或不屬於當前用戶，忽略這部分處理但繼續計算
                    pass
            
        except Feed.DoesNotExist:
            return APIResponse(
                code=404, 
                message=f"找不到ID為 {feed_id} 的飼料",
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 從已驗證的數據中提取寵物信息
        pet_type = pet_info['pet_type']
        
        try:
            pet_weight = float(pet_info['weight'])
            
            # 添加體重合理性檢查
            if pet_weight <= 0:
                return APIResponse(
                    code=400,
                    message="寵物體重必須大於0",
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            if pet_type == 'dog' and pet_weight > 100:
                return APIResponse(
                    code=400,
                    message="狗狗體重超出合理範圍",
                    data={"valid_range": {"min": 0.1, "max": 100}},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            if pet_type == 'cat' and pet_weight > 20:
                return APIResponse(
                    code=400,
                    message="貓咪體重超出合理範圍",
                    data={"valid_range": {"min": 0.1, "max": 20}},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except (ValueError, TypeError):
            return APIResponse(
                code=400,
                message="寵物體重必須為有效數字",
                status=status.HTTP_400_BAD_REQUEST
            )
            
        pet_stage = pet_info['pet_stage']
        
        # 計算寵物的每日代謝能量需求 (kcal/day)
        daily_energy_need = 0
        
        if pet_type == 'dog':
            # 狗的能量需求計算
            if pet_stage == 'adult':
                # 成年犬: 70 * 體重^0.75 * 1.6
                daily_energy_need = 70 * (pet_weight ** 0.75) * 1.6
            elif pet_stage == 'pregnant':
                # 懷孕母犬: 成年犬需求 * 1.5
                daily_energy_need = 70 * (pet_weight ** 0.75) * 1.6 * 1.5
            elif pet_stage == 'lactating':
                # 哺乳母犬: 成年犬需求 * 3
                daily_energy_need = 70 * (pet_weight ** 0.75) * 1.6 * 3
            elif pet_stage == 'puppy':
                # 幼犬: 成年犬需求 * 2
                daily_energy_need = 70 * (pet_weight ** 0.75) * 1.6 * 2
        else:  # cat
            # 貓的能量需求計算
            if pet_stage == 'adult':
                # 成年貓: 70 * 體重^0.75 * 1.4
                daily_energy_need = 70 * (pet_weight ** 0.75) * 1.4
            elif pet_stage == 'pregnant':
                # 懷孕母貓: 成年貓需求 * 1.5
                daily_energy_need = 70 * (pet_weight ** 0.75) * 1.4 * 1.5
            elif pet_stage == 'lactating':
                # 哺乳母貓: 成年貓需求 * 3
                daily_energy_need = 70 * (pet_weight ** 0.75) * 1.4 * 3
            elif pet_stage == 'kitten':
                # 幼貓: 成年貓需求 * 2.5
                daily_energy_need = 70 * (pet_weight ** 0.75) * 1.4 * 2.5
        
        # 計算飼料的代謝能量 (kcal/100g)
        # 修菲公式: ME (kcal/100g) = 4 * 蛋白質% + 9 * 脂肪% + 4 * 碳水化合物%
        feed_energy_per_100g = (4 * feed.protein) + (9 * feed.fat) + (4 * feed.carbohydrate)
        
        # 合理性檢查: 確保飼料能量不為零
        if feed_energy_per_100g <= 0:
            return APIResponse(
                code=400,
                message="飼料營養數據異常，無法計算能量",
                data={
                    "feed_id": feed.id,
                    "name": feed.name,
                    "nutrient_values": {
                        "protein": feed.protein,
                        "fat": feed.fat,
                        "carbohydrate": feed.carbohydrate
                    }
                }
            )
        
        # 計算每日所需的飼料克數
        daily_feed_grams = (daily_energy_need / feed_energy_per_100g) * 100
        
        # 計算結果合理性檢查
        warnings = []
        
        # 檢查計算出的飼料量是否在合理範圍內
        if daily_feed_grams < 10:
            warnings.append("計算出的飼料量過少，請確認寵物信息是否正確")
        elif daily_feed_grams > 1000:
            warnings.append("計算出的飼料量過大，可能超出寵物實際需要")
            
        # 檢查能量是否足夠寵物需求
        energy_per_gram = feed_energy_per_100g / 100
        max_reasonable_amount = 0
        
        if pet_type == 'dog':
            max_reasonable_amount = pet_weight * 30  # 假設狗狗最多吃自身體重30%的飼料
        else:  # cat
            max_reasonable_amount = pet_weight * 20  # 假設貓咪最多吃自身體重20%的飼料
            
        if daily_feed_grams > max_reasonable_amount:
            warnings.append(f"計算出的飼料量可能超出寵物可接受範圍，建議諮詢獸醫")
        
        # 計算每日營養攝入
        daily_nutrition = {
            'protein': (feed.protein / 100) * daily_feed_grams,
            'fat': (feed.fat / 100) * daily_feed_grams,
            'calcium': (feed.calcium / 100) * daily_feed_grams,
            'phosphorus': (feed.phosphorus / 100) * daily_feed_grams,
            'magnesium': (feed.magnesium / 100) * daily_feed_grams,
            'sodium': (feed.sodium / 100) * daily_feed_grams,
            'carbohydrate': (feed.carbohydrate / 100) * daily_feed_grams
        }
        
        # 返回計算結果
        result = {
            'daily_energy_need': round(daily_energy_need, 2),  # kcal/day
            'feed_energy_per_100g': round(feed_energy_per_100g, 2),  # kcal/100g
            'daily_feed_grams': round(daily_feed_grams, 2),  # 每日所需克數
            'daily_nutrition': {k: round(v, 2) for k, v in daily_nutrition.items()},
            'feed_info': {
                'id': feed.id,
                'name': feed.name,
                'protein': feed.protein,
                'fat': feed.fat,
                'calcium': feed.calcium,
                'phosphorus': feed.phosphorus,
                'magnesium': feed.magnesium,
                'sodium': feed.sodium,
                'carbohydrate': feed.carbohydrate
            }
        }
        
        # 添加計算結果的警告信息
        if warnings:
            result['calculation_warnings'] = warnings
        
        # 如果處理狀態有警告，添加警告信息
        if feed.processing_status == 'completed_with_warnings':
            result['feed_warnings'] = feed.processing_error
        
        # 記錄計算結果
        logger.info(
            f"用戶 {request.user.id} 計算了飼料 ID {feed.id} 的營養需求", 
            extra={
                'user_id': request.user.id,
                'feed_id': feed.id,
                'pet_type': pet_type,
                'pet_weight': pet_weight,
                'pet_stage': pet_stage,
                'daily_feed_grams': daily_feed_grams,
                'has_warnings': bool(warnings)
            }
        )
        
        return APIResponse(
            message="營養計算完成",
            data=result
        )

#中文辨識
def extract_nutrition_info_for_chinese(text):
    patterns = {
        'protein': r'粗蛋白\s*[:：]?\s*(\d+\.?\d*)',
        'fat': r'粗脂肪\s*[:：]?\s*(\d+\.?\d*)',
        'calcium': r'鈣\s*[:：]?\s*(\d+\.?\d*)',
        'phosphorus': r'磷\s*[:：]?\s*(\d+\.?\d*)',
        'magnesium': r'鎂\s*[:：]?\s*(\d+\.?\d*)',
        'sodium': r'鈉\s*[:：]?\s*(\d+\.?\d*)',
        'carbohydrate': r'碳水化合物\s*[:：]?\s*(\d+\.?\d*)',
    }

    extracted = {}
    for key, pattern in patterns.items():
        match = re.search(pattern, text)
        if match:
            extracted[key] = float(match.group(1))
    return extracted

#新增飼料
class UploadFeedAPIView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [FeedUploadRateThrottle]
    
    @swagger_auto_schema(
        operation_summary="上傳飼料資訊",
        operation_description="上傳飼料圖片和名稱",
        request_body=UploadFeedSerializer,
        responses={
            200: openapi.Response(
                description="成功上傳並開始處理",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'code': openapi.Schema(type=openapi.TYPE_INTEGER, example=200),
                        'message': openapi.Schema(type=openapi.TYPE_STRING, example="飼料上傳成功"),
                        'data': openapi.Schema(
                            type=openapi.TYPE_OBJECT,
                            properties={
                                'feed_id': openapi.Schema(type=openapi.TYPE_INTEGER),
                                'name': openapi.Schema(type=openapi.TYPE_STRING)
                            }
                        )
                    }
                )
            ),
            400: openapi.Response(description="無效的請求數據"),
            429: openapi.Response(description="上傳頻率超過限制")
        }
    )
    @log_queries
    def post(self, request):
        """
        上傳飼料信息
        
        接收飼料前面和營養成分表的圖片以及飼料名稱，進行處理和保存。
        """
        serializer = UploadFeedSerializer(data=request.data)
        
        if not serializer.is_valid():
            return APIResponse(
                code=ErrorCodes.VALIDATION_ERROR,
                message="上傳數據驗證失敗",
                data={"errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            with transaction.atomic():
                # 創建飼料記錄
                feed = Feed.objects.create(
                    user=request.user,
                    name=serializer.validated_data['name'],
                    processing_status='pending'
                )
                
                # 保存前面圖片
                front_image = serializer.validated_data['front_image']
                front_image_obj = ImageService.save_image(
                    image_file=front_image,
                    owner=request.user,
                    content_type=ContentType.objects.get_for_model(Feed),
                    object_id=feed.id,
                    image_type='feed_front'
                )
                
                # 保存營養成分圖片
                nutrition_image = serializer.validated_data['nutrition_image']
                nutrition_image_obj = ImageService.save_image(
                    image_file=nutrition_image, 
                    owner=request.user,
                    content_type=ContentType.objects.get_for_model(Feed),
                    object_id=feed.id,
                    image_type='feed_nutrition'
                )
                
                # 設置關聯圖片
                feed.front_image = front_image_obj
                feed.nutrition_image = nutrition_image_obj
                feed.save()
                
                # 啟動異步OCR處理任務
                process_feed_ocr.delay(feed.id)
                
                logger.info(
                    f"用戶 {request.user.id} 成功上傳飼料 '{feed.name}'", 
                    extra={
                        'user_id': request.user.id, 
                        'feed_id': feed.id
                    }
                )
                
                return APIResponse(
                    message="飼料上傳成功，開始進行營養信息處理",
                    data={
                        "feed_id": feed.id,
                        "name": feed.name
                    }
                )
                
        except Exception as e:
            logger.error(
                f"處理飼料上傳時出錯: {str(e)}", 
                exc_info=True,
                extra={'user_id': request.user.id if request.user.is_authenticated else None}
            )
            return APIResponse(
                code=ErrorCodes.SERVER_ERROR,
                message="處理飼料上傳時發生錯誤",
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

#顯示最近使用飼料
class RecentUsedFeedsAPIView(APIView):
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    throttle_classes = [BurstRateThrottle]
    
    @swagger_auto_schema(
        operation_summary="獲取最近使用的飼料",
        operation_description="返回用戶最近使用過的飼料列表，結果已分頁",
        responses={
            200: openapi.Response(description="成功獲取最近使用的飼料"),
            500: openapi.Response(description="服務器錯誤")
        }
    )
    @log_queries
    def get(self, request):
        """
        獲取用戶最近使用的飼料列表
        
        返回用戶最近使用過的所有處理完成的飼料，按最近使用時間降序排列
        """
        try:
            # 優化查詢 - 使用 select_related 和 prefetch_related 減少數據庫查詢
            user_feeds = UserFeed.objects.filter(
                user=request.user
            ).select_related(
                'feed'  # 預加載 feed 數據
            ).prefetch_related(
                Prefetch(
                    'feed__users',
                    queryset=UserFeed.objects.filter(user=request.user),
                    to_attr='user_feed_cache'
                )
            ).order_by('-last_used')
            
            # 提取所有飼料對象，用於後續批量加載圖片
            feeds = [user_feed.feed for user_feed in user_feeds 
                    if user_feed.feed.processing_status in ['completed', 'completed_with_warnings']]
            
            if not feeds:
                # 如果沒有符合條件的飼料，直接返回空列表
                paginator = self.pagination_class()
                return paginator.get_paginated_response([])
            
            # 批量預加載所有飼料的圖片
            from feeds.models import Feed
            feed_ids = [feed.id for feed in feeds]
            image_map = ImageService.preload_images_for_objects(feeds, model_class=Feed)
            
            # 構建結果數據
            feeds_data = []
            for user_feed in user_feeds:
                feed = user_feed.feed
                
                # 只顯示處理完成或處理完成但有警告的飼料
                if feed.processing_status in ['completed', 'completed_with_warnings']:
                    # 使用序列化器獲取數據
                    feed_serializer = FeedSerializer(feed)
                    feed_data = feed_serializer.data
                    feed_data['last_used'] = user_feed.last_used.strftime('%Y-%m-%d %H:%M:%S')
                    
                    # 從預加載的圖片中獲取 URL
                    feed_images = image_map.get(feed.id, [])
                    if feed_images:
                        feed_data['front_image_url'] = feed_images[0].img_url.url if len(feed_images) >= 1 and hasattr(feed_images[0].img_url, 'url') else None
                        feed_data['nutrition_image_url'] = feed_images[1].img_url.url if len(feed_images) >= 2 and hasattr(feed_images[1].img_url, 'url') else None
                    
                    feeds_data.append(feed_data)
            
            # 應用分頁
            paginator = self.pagination_class()
            result_page = paginator.paginate_queryset(feeds_data, request)
            
            # 返回分頁結果
            return paginator.get_paginated_response(result_page)
            
        except Exception as e:
            logger.error(f"獲取最近使用的飼料列表時發生錯誤: {str(e)}", exc_info=True)
            return APIResponse(code=500, message=f"獲取飼料列表時發生錯誤: {str(e)}")

#檢查飼料處理狀態
class FeedStatusAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_summary="獲取飼料處理狀態",
        operation_description="查詢指定飼料ID的處理狀態和進度",
        responses={
            200: openapi.Response(
                description="成功獲取處理狀態",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'code': openapi.Schema(type=openapi.TYPE_INTEGER, example=200),
                        'message': openapi.Schema(type=openapi.TYPE_STRING, example="獲取處理狀態成功"),
                        'data': openapi.Schema(
                            type=openapi.TYPE_OBJECT,
                            properties={
                                'feed_id': openapi.Schema(type=openapi.TYPE_INTEGER),
                                'name': openapi.Schema(type=openapi.TYPE_STRING),
                                'processing_status': openapi.Schema(type=openapi.TYPE_STRING, 
                                    description="pending, processing, completed, completed_with_warnings, failed"),
                                'processing_error': openapi.Schema(type=openapi.TYPE_STRING),
                                'last_updated': openapi.Schema(type=openapi.TYPE_STRING, format=openapi.FORMAT_DATETIME)
                            }
                        )
                    }
                )
            ),
            404: openapi.Response(description="飼料未找到"),
            403: openapi.Response(description="無權訪問該飼料信息")
        }
    )
    @log_queries
    def get(self, request, feed_id):
        """
        獲取飼料處理狀態
        
        查詢指定飼料的營養數據處理狀態和進度信息
        """
        try:
            # 獲取飼料記錄
            feed = Feed.objects.get(id=feed_id)
            
            # 權限檢查：只能查看自己的飼料
            if feed.user != request.user:
                return APIResponse(
                    code=ErrorCodes.PERMISSION_DENIED,
                    message="你沒有權限查看此飼料信息",
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # 序列化狀態數據
            serializer = FeedStatusSerializer(feed)
            
            return APIResponse(
                message="獲取處理狀態成功",
                data=serializer.data
            )
            
        except Feed.DoesNotExist:
            return APIResponse(
                code=ErrorCodes.RESOURCE_NOT_FOUND,
                message=f"找不到ID為 {feed_id} 的飼料",
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(
                f"獲取飼料處理狀態時出錯: {str(e)}", 
                exc_info=True,
                extra={'user_id': request.user.id, 'feed_id': feed_id}
            )
            return APIResponse(
                code=ErrorCodes.SERVER_ERROR,
                message="獲取飼料處理狀態時發生錯誤",
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class UserFeedsAPIView(APIView):
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    
    @swagger_auto_schema(
        operation_summary="獲取用戶的飼料列表",
        operation_description="返回用戶上傳的飼料列表，以及處理狀態",
        manual_parameters=[
            openapi.Parameter(
                name='page', in_=openapi.IN_QUERY,
                description='頁碼',
                type=openapi.TYPE_INTEGER
            ),
            openapi.Parameter(
                name='page_size', in_=openapi.IN_QUERY,
                description='每頁數量',
                type=openapi.TYPE_INTEGER
            ),
            openapi.Parameter(
                name='status', in_=openapi.IN_QUERY,
                description='過濾狀態: pending, processing, completed, completed_with_warnings, failed',
                type=openapi.TYPE_STRING
            ),
            openapi.Parameter(
                name='search', in_=openapi.IN_QUERY, 
                description='搜索飼料名稱',
                type=openapi.TYPE_STRING
            )
        ],
        responses={
            200: openapi.Response(
                description="飼料列表獲取成功",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'code': openapi.Schema(type=openapi.TYPE_INTEGER, example=200),
                        'message': openapi.Schema(type=openapi.TYPE_STRING, example="獲取飼料列表成功"),
                        'data': openapi.Schema(
                            type=openapi.TYPE_OBJECT,
                            properties={
                                'count': openapi.Schema(type=openapi.TYPE_INTEGER),
                                'next': openapi.Schema(type=openapi.TYPE_STRING, format=openapi.FORMAT_URI),
                                'previous': openapi.Schema(type=openapi.TYPE_STRING, format=openapi.FORMAT_URI),
                                'results': openapi.Schema(
                                    type=openapi.TYPE_ARRAY,
                                    items=openapi.Schema(type=openapi.TYPE_OBJECT)
                                )
                            }
                        )
                    }
                )
            ),
            400: openapi.Response(description="參數無效")
        }
    )
    @log_queries
    def get(self, request):
        """
        獲取用戶的飼料列表
        
        返回用戶上傳的飼料列表，支持分頁、狀態過濾和名稱搜索
        """
        # 獲取分頁器
        paginator = self.pagination_class()
        
        # 獲取查詢參數
        status_filter = request.query_params.get('status', None)
        search_query = request.query_params.get('search', None)
        
        # 基礎查詢集
        queryset = Feed.objects.filter(user=request.user)
        
        # 優化查詢性能：預先獲取關聯圖片，減少數據庫請求
        queryset = queryset.prefetch_related(
            Prefetch('images', 
                     queryset=Image.objects.filter(
                         content_type=ContentType.objects.get_for_model(Feed)
                     ),
                     to_attr='prefetched_images'
                    )
        ).order_by('-created_at')
        
        # 應用狀態過濾
        if status_filter:
            if status_filter not in ['pending', 'processing', 'completed', 'completed_with_warnings', 'failed']:
                return APIResponse(
                    code=ErrorCodes.INVALID_PARAMETERS,
                    message="無效的狀態過濾參數",
                    data={"valid_status": ['pending', 'processing', 'completed', 'completed_with_warnings', 'failed']},
                    status=status.HTTP_400_BAD_REQUEST
                )
            queryset = queryset.filter(processing_status=status_filter)
        
        # 應用搜索過濾
        if search_query:
            queryset = queryset.filter(name__icontains=search_query)
        
        # 執行分頁
        page = paginator.paginate_queryset(queryset, request, view=self)
        if page is None:
            return APIResponse(
                code=ErrorCodes.RESOURCE_NOT_FOUND,
                message="指定的頁碼超出範圍",
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 序列化
        serializer = FeedSerializer(page, many=True, context={'request': request})
        
        logger.info(
            f"用戶 {request.user.id} 獲取了飼料列表", 
            extra={
                'user_id': request.user.id,
                'status_filter': status_filter,
                'search_query': search_query,
                'count': len(page)
            }
        )
        
        # 返回結果
        return APIResponse(
            message="獲取飼料列表成功",
            data=paginator.get_paginated_response(serializer.data).data
        )

class FeedDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_summary="獲取飼料詳情",
        operation_description="根據ID獲取飼料的詳細信息，包括營養成分和處理狀態",
        responses={
            200: openapi.Response(
                description="成功獲取飼料詳情",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'code': openapi.Schema(type=openapi.TYPE_INTEGER, example=200),
                        'message': openapi.Schema(type=openapi.TYPE_STRING, example="獲取飼料詳情成功"),
                        'data': openapi.Schema(
                            type=openapi.TYPE_OBJECT,
                            properties={
                                'id': openapi.Schema(type=openapi.TYPE_INTEGER),
                                'name': openapi.Schema(type=openapi.TYPE_STRING),
                                'processing_status': openapi.Schema(type=openapi.TYPE_STRING),
                                'protein': openapi.Schema(type=openapi.TYPE_NUMBER),
                                'fat': openapi.Schema(type=openapi.TYPE_NUMBER),
                                'images': openapi.Schema(type=openapi.TYPE_ARRAY, items=openapi.Schema(type=openapi.TYPE_OBJECT))
                            }
                        )
                    }
                )
            ),
            404: openapi.Response(description="飼料未找到"),
            403: openapi.Response(description="無權訪問該飼料信息")
        }
    )
    @log_queries
    def get(self, request, feed_id):
        """
        根據ID獲取飼料詳細信息
        
        返回指定ID的飼料完整信息，包括營養成分數據和關聯圖片
        """
        try:
            # 獲取飼料信息
            feed = Feed.objects.get(id=feed_id)
            
            # 權限檢查：只能查看自己的飼料信息
            if feed.user != request.user:
                return APIResponse(
                    code=ErrorCodes.PERMISSION_DENIED,
                    message="你沒有權限查看此飼料信息",
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # 序列化飼料數據
            serializer = FeedSerializer(feed, context={'request': request})
            
            # 添加用户最近查看記錄
            UserFeed.objects.update_or_create(
                user=request.user,
                feed=feed,
                defaults={'last_used': timezone.now()}
            )
            
            logger.info(
                f"用戶 {request.user.id} 查看了飼料 ID {feed_id} 的詳情", 
                extra={
                    'user_id': request.user.id,
                    'feed_id': feed_id
                }
            )
            
            return APIResponse(
                message="獲取飼料詳情成功",
                data=serializer.data
            )
            
        except Feed.DoesNotExist:
            return APIResponse(
                code=ErrorCodes.RESOURCE_NOT_FOUND,
                message=f"找不到ID為 {feed_id} 的飼料",
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(
                f"獲取飼料詳情時出錯: {str(e)}", 
                exc_info=True,
                extra={'user_id': request.user.id, 'feed_id': feed_id}
            )
            return APIResponse(
                code=ErrorCodes.SERVER_ERROR,
                message="獲取飼料詳情時發生錯誤",
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

# === 寵物飼料 API ===
class PetFeedAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_summary="獲取寵物的飼料記錄",
        operation_description="返回特定寵物的飼料使用記錄",
        responses={
            200: openapi.Response(description="成功獲取寵物飼料記錄"),
            404: openapi.Response(description="寵物不存在或不屬於當前用戶")
        }
    )
    @log_queries
    def get(self, request, pet_id):
        """
        獲取特定寵物的飼料使用記錄
        """
        try:
            # 確認寵物存在且屬於當前用戶
            pet = Pet.objects.get(id=pet_id, owner=request.user)
            
            # 獲取寵物的飼料記錄，按最近使用時間排序
            pet_feeds = PetFeed.objects.filter(pet=pet).select_related('feed').order_by('-last_used')
            
            # 序列化數據
            serializer = PetFeedSerializer(pet_feeds, many=True)
            
            return APIResponse(
                data=serializer.data,
                message="獲取寵物飼料記錄成功"
            )
            
        except Pet.DoesNotExist:
            return APIResponse(
                status=status.HTTP_404_NOT_FOUND,
                message="寵物不存在或不屬於當前用戶",
                errors={"pet_id": "寵物不存在或不屬於您"}
            )
    
    @swagger_auto_schema(
        operation_summary="為寵物添加飼料記錄",
        operation_description="為特定寵物添加或更新飼料使用記錄",
        request_body=PetFeedCreateSerializer,
        responses={
            201: openapi.Response(description="成功添加飼料記錄"),
            400: openapi.Response(description="請求數據無效"),
            404: openapi.Response(description="寵物或飼料不存在")
        }
    )
    @log_queries
    @transaction.atomic
    def post(self, request, pet_id):
        """
        為特定寵物添加飼料使用記錄
        """
        try:
            # 確認寵物存在且屬於當前用戶
            pet = Pet.objects.get(id=pet_id, owner=request.user)
            
            # 添加寵物ID到請求數據
            data = request.data.copy()
            data['pet'] = pet_id
            
            # 使用序列化器驗證請求數據
            serializer = PetFeedCreateSerializer(data=data, context={'request': request})
            if not serializer.is_valid():
                return APIResponse(
                    status=status.HTTP_400_BAD_REQUEST,
                    message="請求數據無效",
                    errors=serializer.errors
                )
            
            # 保存寵物飼料記錄
            pet_feed = serializer.save()
            
            # 返回新創建的記錄
            response_serializer = PetFeedSerializer(pet_feed)
            
            return APIResponse(
                status=status.HTTP_201_CREATED,
                data=response_serializer.data,
                message="寵物飼料記錄添加成功"
            )
            
        except Pet.DoesNotExist:
            return APIResponse(
                status=status.HTTP_404_NOT_FOUND,
                message="寵物不存在或不屬於當前用戶",
                errors={"pet_id": "寵物不存在或不屬於您"}
            )
        except Feed.DoesNotExist:
            return APIResponse(
                status=status.HTTP_404_NOT_FOUND,
                message="飼料不存在",
                errors={"feed": "飼料不存在"}
            )

# === 寵物當前飼料 API ===
class PetCurrentFeedAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_summary="獲取寵物當前使用的飼料",
        operation_description="返回特定寵物當前使用的飼料記錄",
        responses={
            200: openapi.Response(description="成功獲取寵物當前飼料"),
            404: openapi.Response(description="寵物不存在或無當前飼料記錄")
        }
    )
    @log_queries
    def get(self, request, pet_id):
        """
        獲取特定寵物當前使用的飼料
        """
        try:
            # 確認寵物存在且屬於當前用戶
            pet = Pet.objects.get(id=pet_id, owner=request.user)
            
            # 獲取寵物當前使用的飼料
            try:
                current_feed = PetFeed.objects.filter(pet=pet, is_current=True).select_related('feed').first()
                
                if not current_feed:
                    return APIResponse(
                        status=status.HTTP_404_NOT_FOUND,
                        message="寵物沒有設置當前使用的飼料",
                        errors={"pet_id": "未找到當前飼料記錄"}
                    )
                
                # 序列化數據
                serializer = PetFeedSerializer(current_feed)
                
                return APIResponse(
                    data=serializer.data,
                    message="獲取寵物當前飼料成功"
                )
                
            except PetFeed.DoesNotExist:
                return APIResponse(
                    status=status.HTTP_404_NOT_FOUND,
                    message="寵物沒有設置當前使用的飼料",
                    errors={"pet_id": "未找到當前飼料記錄"}
                )
            
        except Pet.DoesNotExist:
            return APIResponse(
                status=status.HTTP_404_NOT_FOUND,
                message="寵物不存在或不屬於當前用戶",
                errors={"pet_id": "寵物不存在或不屬於您"}
            )
