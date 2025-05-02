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
from .serializers import UploadFeedSerializer, NutritionCalculatorRequestSerializer, FeedStatusSerializer, FeedSerializer
from .tasks import process_feed_ocr
from django.core.exceptions import ValidationError
from django.http import Http404
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from rest_framework.pagination import StandardResultsSetPagination
from django.db.models import Prefetch
from utils.image_service import ImageService

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
            raise ValidationError(serializer.errors)
            
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
                
            # 添加用户最近使用的飼料記錄
            UserFeed.objects.update_or_create(
                user=request.user,
                feed=feed,
                defaults={'last_used': timezone.now()}
            )
            
        except Feed.DoesNotExist:
            raise Http404(f"找不到 ID 為 {feed_id} 的飼料")
        
        # 從已驗證的數據中提取寵物信息
        pet_type = pet_info['pet_type']
        pet_weight = float(pet_info['weight'])
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
        
        # 計算每日所需的飼料克數
        daily_feed_grams = (daily_energy_need / feed_energy_per_100g) * 100
        
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
        
        # 如果處理狀態有警告，添加警告信息
        if feed.processing_status == 'completed_with_warnings':
            result['warning'] = feed.processing_error
        
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
    
    @swagger_auto_schema(
        operation_summary="上傳飼料信息",
        operation_description="上傳飼料的基本信息、正面圖和營養成分圖",
        responses={
            201: openapi.Response(description="飼料信息上傳成功"),
            400: openapi.Response(description="參數無效"),
            500: openapi.Response(description="服務器錯誤")
        }
    )
    @log_queries
    def post(self, request):
        """
        上傳飼料信息，包括飼料正面圖和營養成分圖，提取營養信息
        """
        serializer = UploadFeedSerializer(data=request.data)
        if not serializer.is_valid():
            raise ValidationError(serializer.errors)

        try:
            with transaction.atomic():
                # 創建飼料記錄
                feed = Feed.objects.create(
                    name=serializer.validated_data['name'],
                    # 初始化營養信息為0，以後由OCR更新
                    protein=0, fat=0, calcium=0, 
                    phosphorus=0, magnesium=0, sodium=0, carbohydrate=0,
                    # 添加處理狀態字段
                    processing_status='pending',
                    processing_error=''
                )

                # 儲存飼料正面圖片
                front_image = request.FILES['front_image']
                front_img = Image.objects.create(
                    content_type=ContentType.objects.get_for_model(Feed),
                    object_id=feed.id,
                    img_url=front_image,
                    sort_order=1,
                    alt_text=f"{feed.name} - 正面圖"
                )

                # 儲存營養成分圖片
                nutrition_image = request.FILES['nutrition_image']
                nutrition_img = Image.objects.create(
                    content_type=ContentType.objects.get_for_model(Feed),
                    object_id=feed.id,
                    img_url=nutrition_image,
                    sort_order=2,
                    alt_text=f"{feed.name} - 營養成分圖"
                )

                # 將營養圖片保存到臨時文件以進行異步處理
                with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as temp_file:
                    nutrition_image.seek(0)
                    temp_file.write(nutrition_image.read())
                    temp_path = temp_file.name

                # 添加用户最近使用的飼料記錄
                UserFeed.objects.update_or_create(
                    user=request.user,
                    feed=feed,
                    defaults={'last_used': timezone.now()}
                )
                
                # 清除任何可能存在的舊緩存
                ImageService.invalidate_image_cache(feed.id, Feed)
                
                # 啟動非同步任務進行OCR處理
                from feeds.tasks import process_feed_ocr
                process_feed_ocr.delay(
                    feed_id=feed.id,
                    nutrition_image_temp_path=temp_path,
                    front_image_id=front_img.id,
                    nutrition_image_id=nutrition_img.id
                )

                # 獲取圖片 URL
                front_image_url = front_img.img_url.url if hasattr(front_img.img_url, 'url') else None
                nutrition_image_url = nutrition_img.img_url.url if hasattr(nutrition_img.img_url, 'url') else None

                return APIResponse(
                    code=201,
                    message="飼料信息上傳成功，正在處理中",
                    data={
                        "feed_id": feed.id,
                        "name": feed.name,
                        "front_image_url": front_image_url,
                        "nutrition_image_url": nutrition_image_url,
                        "processing_status": feed.processing_status
                    }
                )

        except Exception as e:
            logger.error(f"上傳飼料信息時發生錯誤: {str(e)}", exc_info=True)
            # 如果發生錯誤，將自動回滾事務
            return APIResponse(
                code=500, 
                message=f"上傳飼料信息失敗: {str(e)}"
            )

#顯示最近使用飼料
class RecentUsedFeedsAPIView(APIView):
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    
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
class FeedProcessingStatusAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_summary="獲取飼料處理狀態",
        operation_description="獲取指定飼料的處理狀態和結果",
        responses={
            200: openapi.Response(description="成功獲取飼料處理狀態"),
            403: openapi.Response(description="無權訪問"),
            404: openapi.Response(description="飼料不存在")
        }
    )
    @log_queries
    def get(self, request, feed_id):
        """
        獲取指定飼料的處理狀態
        
        檢查飼料營養信息提取的處理狀態，包括處理進度、結果或錯誤信息
        """
        try:
            # 獲取飼料對象
            feed = Feed.objects.get(id=feed_id)
            
            # 檢查當前用戶是否有權訪問此飼料
            is_owner = UserFeed.objects.filter(user=request.user, feed=feed).exists()
            if not is_owner:
                return APIResponse(code=403, message="您無權訪問此飼料的處理狀態")
            
            # 使用序列化器獲取基本處理狀態
            status_serializer = FeedStatusSerializer(feed)
            response_data = status_serializer.data
            
            # 如果處理完成，添加營養信息
            if feed.processing_status in ['completed', 'completed_with_warnings']:
                # 使用完整序列化器獲取詳細信息
                feed_serializer = FeedSerializer(feed)
                response_data.update({"nutrition_info": feed_serializer.data})
                
                # 獲取飼料的圖片 URL
                front_image_url, nutrition_image_url = ImageService.get_feed_image_urls(feed.id)
                response_data['front_image_url'] = front_image_url
                response_data['nutrition_image_url'] = nutrition_image_url
            
            return APIResponse(
                message="獲取飼料處理狀態成功",
                data=response_data
            )
            
        except Feed.DoesNotExist:
            return APIResponse(code=404, message="飼料不存在")
        except Exception as e:
            logger.error(f"獲取飼料處理狀態時發生錯誤: {str(e)}", exc_info=True)
            return APIResponse(code=500, message=f"獲取飼料處理狀態時發生錯誤: {str(e)}")
