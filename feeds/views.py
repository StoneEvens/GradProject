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
from django.db import transaction
from django.contrib.contenttypes.models import ContentType
from .serializers import UploadFeedSerializer
from .tasks import process_feed_ocr

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
    
    @log_queries
    def post(self, request):
        # 獲取請求參數
        feed_id = request.data.get('feed_id')
        pet_info = request.data.get('pet_info', {})
        
        # 驗證必要參數
        if not feed_id:
            return APIResponse(code=400, message="缺少必要參數: feed_id")
        
        if not pet_info:
            return APIResponse(code=400, message="缺少必要參數: pet_info")
            
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
            return APIResponse(code=404, message=f"找不到 ID 為 {feed_id} 的飼料")
        
        # 提取寵物信息
        pet_type = pet_info.get('pet_type')
        pet_weight = pet_info.get('weight')
        pet_stage = pet_info.get('pet_stage')
        
        # 驗證寵物信息
        if not pet_type or not isinstance(pet_weight, (int, float)) or not pet_stage:
            return APIResponse(code=400, message="寵物信息不完整或格式不正確")
        
        if pet_type not in ['dog', 'cat']:
            return APIResponse(code=400, message="寵物類型必須為 'dog' 或 'cat'")
        
        valid_stages = ['adult', 'pregnant', 'lactating', 'puppy', 'kitten']
        if pet_stage not in valid_stages:
            return APIResponse(code=400, message=f"寵物階段必須為以下之一: {', '.join(valid_stages)}")
        
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
    
    @log_queries
    def post(self, request):
        """
        上傳飼料信息，包括飼料正面圖和營養成分圖，提取營養信息
        """
        serializer = UploadFeedSerializer(data=request.data)
        if not serializer.is_valid():
            errors = {}
            for field, error_messages in serializer.errors.items():
                errors[field] = error_messages
            return APIResponse(code=400, message="參數驗證失敗", data=errors)

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
                # 圖片安全性已在序列化器中驗證過
                front_img = Image.objects.create(
                    content_type=ContentType.objects.get_for_model(Feed),
                    object_id=feed.id,
                    img_url=front_image,
                    sort_order=1,
                    alt_text=f"{feed.name} - 正面圖"
                )

                # 儲存營養成分圖片
                nutrition_image = request.FILES['nutrition_image']
                # 圖片安全性已在序列化器中驗證過
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
                
                # 啟動非同步任務進行OCR處理
                from feeds.tasks import process_feed_ocr
                process_feed_ocr.delay(
                    feed_id=feed.id,
                    nutrition_image_temp_path=temp_path,
                    front_image_id=front_img.id,
                    nutrition_image_id=nutrition_img.id
                )

                return APIResponse(
                    code=201,
                    message="飼料信息上傳成功，正在處理中",
                    data={
                        "feed_id": feed.id,
                        "name": feed.name,
                        "front_image_url": front_img.img_url.url,
                        "nutrition_image_url": nutrition_img.img_url.url,
                        "processing_status": feed.processing_status
                    }
                )

        except Exception as e:
            # 確保在發生錯誤時刪除任何臨時文件
            try:
                if 'temp_path' in locals() and os.path.exists(temp_path):
                    os.remove(temp_path)
            except Exception:
                pass  # 如果刪除臨時文件失敗，忽略錯誤
                
            logger.error(f"上傳飼料時發生錯誤: {str(e)}", exc_info=True)
            return APIResponse(code=500, message=f"處理上傳時發生錯誤: {str(e)}")

#顯示最近使用飼料
class RecentUsedFeedsAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    @log_queries
    def get(self, request):
        """
        獲取用戶最近使用的飼料列表
        """
        try:
            # 使用 select_related 優化查詢性能
            user_feeds = UserFeed.objects.filter(
                user=request.user
            ).select_related('feed').order_by('-last_used')[:10]
            
            # 提取飼料資訊並過濾掉未完成處理的飼料
            feeds_data = []
            for user_feed in user_feeds:
                feed = user_feed.feed
                
                # 只顯示處理完成或處理完成但有警告的飼料
                if feed.processing_status in ['completed', 'completed_with_warnings']:
                    feed_data = {
                        'id': feed.id,
                        'name': feed.name,
                        'protein': feed.protein,
                        'fat': feed.fat,
                        'calcium': feed.calcium,
                        'phosphorus': feed.phosphorus,
                        'magnesium': feed.magnesium,
                        'sodium': feed.sodium,
                        'carbohydrate': feed.carbohydrate,
                        'last_used': user_feed.last_used.strftime('%Y-%m-%d %H:%M:%S')
                    }
                    
                    # 獲取飼料的圖片
                    from django.contrib.contenttypes.models import ContentType
                    feed_content_type = ContentType.objects.get_for_model(Feed)
                    images = Image.objects.filter(
                        content_type=feed_content_type,
                        object_id=feed.id
                    ).order_by('sort_order')
                    
                    if images.exists():
                        feed_data['front_image_url'] = images.first().img_url.url if images.count() >= 1 else None
                        feed_data['nutrition_image_url'] = images.last().img_url.url if images.count() >= 2 else None
                    
                    feeds_data.append(feed_data)
            
            return APIResponse(
                message="成功獲取最近使用的飼料列表",
                data=feeds_data
            )
            
        except Exception as e:
            logger.error(f"獲取最近使用的飼料列表時發生錯誤: {str(e)}", exc_info=True)
            return APIResponse(code=500, message=f"獲取飼料列表時發生錯誤: {str(e)}")

#檢查飼料處理狀態
class FeedProcessingStatusAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, feed_id):
        """
        獲取指定飼料的處理狀態
        """
        try:
            feed = Feed.objects.get(id=feed_id)
            
            # 檢查當前用戶是否有權訪問此飼料
            is_owner = UserFeed.objects.filter(user=request.user, feed=feed).exists()
            if not is_owner:
                return APIResponse(code=403, message="您無權訪問此飼料的處理狀態")
            
            # 構建響應數據
            response_data = {
                "feed_id": feed.id,
                "name": feed.name,
                "processing_status": feed.processing_status,
            }
            
            # 如果處理失敗或有警告，添加錯誤信息
            if feed.processing_status in ['failed', 'completed_with_warnings']:
                response_data["processing_error"] = feed.processing_error
                
            # 如果處理完成，添加處理結果
            if feed.processing_status in ['completed', 'completed_with_warnings']:
                response_data["nutrition_info"] = {
                    "protein": feed.protein,
                    "fat": feed.fat,
                    "calcium": feed.calcium,
                    "phosphorus": feed.phosphorus,
                    "magnesium": feed.magnesium,
                    "sodium": feed.sodium,
                    "carbohydrate": feed.carbohydrate
                }
                
                # 獲取飼料的圖片
                from django.contrib.contenttypes.models import ContentType
                feed_content_type = ContentType.objects.get_for_model(Feed)
                images = Image.objects.filter(
                    content_type=feed_content_type,
                    object_id=feed.id
                ).order_by('sort_order')
                
                if images.exists():
                    response_data['front_image_url'] = images.first().img_url.url if images.count() >= 1 else None
                    response_data['nutrition_image_url'] = images.last().img_url.url if images.count() >= 2 else None
                
            return APIResponse(
                message="成功獲取飼料處理狀態",
                data=response_data
            )
            
        except Feed.DoesNotExist:
            return APIResponse(code=404, message=f"找不到 ID 為 {feed_id} 的飼料")
            
        except Exception as e:
            logger.error(f"獲取飼料處理狀態時發生錯誤: {str(e)}", exc_info=True)
            return APIResponse(code=500, message=f"獲取飼料處理狀態時發生錯誤: {str(e)}")
