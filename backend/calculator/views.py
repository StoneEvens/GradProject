from rest_framework.parsers import FormParser, MultiPartParser, JSONParser
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from drf_yasg.utils import swagger_auto_schema
from utils.firebase_service import FirebaseStorageService
from drf_yasg import openapi
from openai import OpenAI, APIError
from dotenv import load_dotenv
import os, math, json
from pathlib import Path
import io

from pets.models import Pet
from feeds.models import Feed, UserFeed
from .serializers import PetSerializer
from ocrapp.models import HealthReport
from ocrapp.views import convert_ocr_to_health_data
from feeds.serializers import FeedSerializer, UserFeedSerializer
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAuthenticated

User = get_user_model()

class PetListByUser(APIView):
    permission_classes = [AllowAny]  
    def get(self, request):
        user_id = request.query_params.get("user_id")
        if not user_id:
            return Response({"error": "請提供 user_id"}, status=status.HTTP_400_BAD_REQUEST)

        pets = Pet.objects.filter(owner_id=user_id)
        serializer = PetSerializer(pets, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)
class PetCreateView(APIView):
    permission_classes = [AllowAny] 
    parser_classes = [FormParser, MultiPartParser]  # 新增解析 multipart/form-data 的支援

    def post(self, request):
        data = request.data
        user_id = data.get("user_id")

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"error": "找不到使用者"}, status=status.HTTP_400_BAD_REQUEST)

        # 先建立寵物，暫時不包含 avatar
        # 將 is_dog 轉換為 pet_type
        is_dog = data.get("is_dog") in ['true', 'True', True]
        pet_type = 'dog' if is_dog else 'cat'
        
        pet = Pet.objects.create(
            pet_name=data.get("pet_name"),
            pet_type=pet_type,
            pet_stage=data.get("life_stage"),
            weight=data.get("weight"),
            height=data.get("length"),  # length -> height
            predicted_adult_weight=data.get("expect_adult_weight"),
            weeks_of_lactation=data.get("weeks_of_lactation"),
            owner=user  # keeper_id -> owner
        )

        pet_avatar_file = request.FILES.get("pet_avatar")
        if pet_avatar_file:
            storage_service = FirebaseStorageService()
            success, msg, firebase_url, firebase_path = storage_service.upload_pet_photo(
                user_id=user.id,
                pet_id=pet.id,
                photo_file=pet_avatar_file,
                photo_type='headshot'
            )
            if success:
                pet.pet_avatar = firebase_url
                pet.save()
            else:
                return Response({"error": f"圖片上傳失敗：{msg}"}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"message": "寵物建立成功", "pet_id": pet.id, "pet_avatar": pet.pet_avatar}, status=status.HTTP_201_CREATED)
class PetUpdateView(APIView):
    permission_classes = [AllowAny] 
    def post(self, request):
        pet_id = request.data.get("pet_id")
        if not pet_id:
            return Response({"error": "請提供 pet_id"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            pet = Pet.objects.get(id=pet_id)
        except Pet.DoesNotExist:
            return Response({"error": "找不到該寵物"}, status=status.HTTP_400_BAD_REQUEST)

        # 處理欄位名稱對應
        field_mapping = {
            "life_stage": "pet_stage",
            "length": "height",
            "expect_adult_weight": "predicted_adult_weight",
            "is_dog": None,  # 需要特殊處理
            "pet_avatar": "pet_avatar",
            "weight": "weight",
            "weeks_of_lactation": "weeks_of_lactation"
        }
        
        for frontend_field, model_field in field_mapping.items():
            value = request.data.get(frontend_field)
            if value is not None:
                if frontend_field == "is_dog":
                    # 將 is_dog 轉換為 pet_type
                    is_dog = value in ['true', 'True', True]
                    pet.pet_type = 'dog' if is_dog else 'cat'
                elif model_field:
                    setattr(pet, model_field, value)

        pet.save()

        return Response({
            "message": "更新成功",
            "pet_id": pet.id,
            "pet_avatar": getattr(pet, 'pet_avatar', None),
            "is_dog": pet.pet_type == 'dog',
            "new_life_stage": pet.pet_stage,
            "new_weight": pet.weight,
            "new_length": pet.height,
            "new_expect_adult_weight": pet.predicted_adult_weight,
            "new_weeks_of_lacation": pet.weeks_of_lactation
        }, status=status.HTTP_200_OK)
class FeedListByUser(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """取得使用者的飼料清單（基於 UserFeed 關係）"""
        pet_id = request.query_params.get('pet_id')
        
        queryset = UserFeed.objects.filter(user=request.user).select_related('feed', 'pet')
        
        # 根據寵物ID篩選
        if pet_id:
            try:
                from pets.models import Pet
                pet = Pet.objects.get(id=pet_id, owner=request.user)
                queryset = queryset.filter(pet=pet)
            except Pet.DoesNotExist:
                return Response({
                    "error": "找不到該寵物或您沒有權限"
                }, status=status.HTTP_404_NOT_FOUND)
        
        user_feeds = queryset.order_by('-last_used_at')
        serializer = UserFeedSerializer(user_feeds, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)
class FeedCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def _upload_feed_image(self, feed, image_data, image_type):
        """
        上傳飼料圖片到 Firebase，參考 abnormal post 的邏輯
        """
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
                # 從 header 中提取 MIME 類型
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
            else:
                logger.error(f"飼料圖片 {image_type} 上傳失敗: {message}")
                
        except Exception as e:
            logger.error(f"處理飼料圖片 {image_type} 時出錯: {str(e)}", exc_info=True)

    def post(self, request):
        data = request.data
        user = request.user

        def parse_float(value):
            try:
                return float(value)
            except (TypeError, ValueError):
                return 0.0

        # 必要欄位驗證
        name = data.get("name", "").strip()
        brand = data.get("brand", "").strip()
        pet_type = data.get("pet_type", "cat")
        pet_id = data.get("pet_id")
        
        if not name or not brand:
            return Response({
                "error": "名稱和品牌為必填欄位"
            }, status=status.HTTP_400_BAD_REQUEST)

        if pet_type not in ['cat', 'dog']:
            return Response({
                "error": "pet_type 必須是 'cat' 或 'dog'"
            }, status=status.HTTP_400_BAD_REQUEST)
            
        if not pet_id:
            return Response({
                "error": "請提供 pet_id"
            }, status=status.HTTP_400_BAD_REQUEST)
            
        # 驗證寵物是否屬於該用戶
        try:
            from pets.models import Pet
            pet = Pet.objects.get(id=pet_id, owner=user)
        except Pet.DoesNotExist:
            return Response({
                "error": "找不到該寵物或您沒有權限"
            }, status=status.HTTP_404_NOT_FOUND)

        try:
            from django.db import transaction
            with transaction.atomic():
                # 檢查是否已存在相同營養成分的飼料（只比對營養成分和寵物類型）
                existing_feed = Feed.objects.filter(
                    pet_type=pet_type,
                    protein=parse_float(data.get("protein")),
                    fat=parse_float(data.get("fat")),
                    carbohydrate=parse_float(data.get("carbohydrate")),
                    calcium=parse_float(data.get("calcium")),
                    phosphorus=parse_float(data.get("phosphorus")),
                    magnesium=parse_float(data.get("magnesium")),
                    sodium=parse_float(data.get("sodium"))
                ).first()

                if existing_feed:
                    # 如果飼料已存在，建立或更新 UserFeed 關係（以寵物為單位）
                    user_feed, created = UserFeed.objects.get_or_create(
                        user=user,
                        feed=existing_feed,
                        pet=pet,
                        defaults={'usage_count': 0}
                    )
                    
                    if not created:
                        # 如果關係已存在，只更新最後使用時間，不增加使用次數
                        user_feed.last_used_at = timezone.now()
                        user_feed.save(update_fields=['last_used_at'])
                    
                    return Response({
                        "message": "資料庫中已有此飼料，直接幫您匹配",
                        "feed_id": existing_feed.id,
                        "data": UserFeedSerializer(user_feed).data,
                        "is_existing": True
                    }, status=status.HTTP_200_OK)
                
                else:
                    # 建立新的共用飼料
                    new_feed = Feed.objects.create(
                        name=name,
                        brand=brand,
                        pet_type=pet_type,
                        protein=parse_float(data.get("protein")),
                        fat=parse_float(data.get("fat")),
                        carbohydrate=parse_float(data.get("carbohydrate")),
                        calcium=parse_float(data.get("calcium")),
                        phosphorus=parse_float(data.get("phosphorus")),
                        magnesium=parse_float(data.get("magnesium")),
                        sodium=parse_float(data.get("sodium")),
                        price=data.get("price", 0),
                        created_by=user
                    )
                    
                    # 處理圖片上傳 - 參考 abnormal post 的邏輯
                    front_image = data.get("front_image")
                    nutrition_image = data.get("nutrition_image")
                    
                    # 處理正面圖片
                    if front_image:
                        self._upload_feed_image(new_feed, front_image, 'front')
                    
                    # 處理營養標籤圖片  
                    if nutrition_image:
                        self._upload_feed_image(new_feed, nutrition_image, 'nutrition')

                    # 建立 UserFeed 關係
                    user_feed = UserFeed.objects.create(
                        user=user,
                        feed=new_feed,
                        pet=pet,
                        usage_count=1
                    )

                    return Response({
                        "message": "新飼料建立成功",
                        "feed_id": new_feed.id,
                        "data": UserFeedSerializer(user_feed).data,
                        "is_existing": False
                    }, status=status.HTTP_201_CREATED)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                "error": f"建立飼料時發生錯誤：{str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
class FeedUpdateView(APIView):
    """飼料資訊驗證 API - 僅驗證不更新資料庫"""
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def post(self, request):
        """驗證飼料資訊格式，但不更新資料庫"""
        data = request.data
        user = request.user
        feed_id = data.get("feed_id")

        if not feed_id:
            return Response({
                "error": "請提供 feed_id"
            }, status=status.HTTP_400_BAD_REQUEST)

        def parse_float(value):
            try:
                return float(value)
            except (TypeError, ValueError):
                return None

        try:
            # 檢查用戶是否有權限存取該飼料
            user_feed = UserFeed.objects.select_related('feed').get(
                user=user, 
                feed_id=feed_id
            )
        except UserFeed.DoesNotExist:
            return Response({
                "error": "找不到該飼料或您沒有權限存取"
            }, status=status.HTTP_404_NOT_FOUND)

        # 驗證資料格式但不儲存
        validated_data = {}
        validation_errors = []
        
        # 驗證營養素數值
        nutrition_fields = [
            'protein', 'fat', 'carbohydrate', 'calcium', 
            'phosphorus', 'magnesium', 'sodium'
        ]
        
        for field in nutrition_fields:
            if field in data:
                value = parse_float(data.get(field))
                if value is not None and value >= 0:
                    validated_data[field] = value
                elif value is not None and value < 0:
                    validation_errors.append(f"{field} 不能為負數")
                else:
                    validation_errors.append(f"{field} 格式不正確")
        
        # 驗證文字欄位
        if 'name' in data:
            name = data.get('name', '').strip()
            if len(name) > 100:
                validation_errors.append("飼料名稱不能超過100字元")
            else:
                validated_data['name'] = name
                
        if 'brand' in data:
            brand = data.get('brand', '').strip()
            if len(brand) > 100:
                validation_errors.append("品牌名稱不能超過100字元")
            else:
                validated_data['brand'] = brand

        if validation_errors:
            return Response({
                "error": "資料驗證失敗",
                "validation_errors": validation_errors
            }, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "message": "資料驗證成功，前端可進行計算",
            "validated_data": validated_data,
            "feed_info": {
                "id": user_feed.feed.id,
                "name": user_feed.feed.name,
                "brand": user_feed.feed.brand
            }
        }, status=status.HTTP_200_OK)


class SharedFeedListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """取得共用飼料清單（可根據寵物類型篩選）"""
        pet_type = request.query_params.get('pet_type')
        search = request.query_params.get('search', '').strip()
        
        queryset = Feed.objects.all().order_by('-created_at')
        
        if pet_type in ['cat', 'dog']:
            queryset = queryset.filter(pet_type=pet_type)
            
        if search:
            from django.db import models
            queryset = queryset.filter(
                models.Q(name__icontains=search) | 
                models.Q(brand__icontains=search)
            )
        
        # 限制結果數量
        queryset = queryset[:50]
        
        serializer = FeedSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AddExistingFeedView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """將現有的共用飼料加入使用者的飼料清單"""
        feed_id = request.data.get('feed_id')
        user = request.user
        
        if not feed_id:
            return Response({
                "error": "請提供 feed_id"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            feed = Feed.objects.get(id=feed_id)
        except Feed.DoesNotExist:
            return Response({
                "error": "找不到指定的飼料"
            }, status=status.HTTP_404_NOT_FOUND)
        
        pet_id = request.data.get('pet_id')
        if not pet_id:
            return Response({
                "error": "請提供 pet_id"
            }, status=status.HTTP_400_BAD_REQUEST)
            
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
            
            return Response({
                "message": message,
                "data": UserFeedSerializer(user_feed).data
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                "error": f"加入飼料時發生錯誤：{str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# 載入 OpenAI API 金鑰
load_dotenv()
api_key = os.getenv('OPENAI_API_KEY')
client = OpenAI(api_key=api_key)



class FeedUsageTracker(APIView):
    """記錄飼料使用次數的 API"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """更新飼料使用次數"""
        feed_id = request.data.get('feed_id')
        user = request.user
        
        if not feed_id:
            return Response({
                "error": "請提供 feed_id"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        pet_id = request.data.get('pet_id')
        if not pet_id:
            return Response({
                "error": "請提供 pet_id"
            }, status=status.HTTP_400_BAD_REQUEST)
            
        # 驗證寵物是否屬於該用戶
        try:
            from pets.models import Pet
            pet = Pet.objects.get(id=pet_id, owner=user)
        except Pet.DoesNotExist:
            return Response({
                "error": "找不到該寵物或您沒有權限"
            }, status=status.HTTP_404_NOT_FOUND)
        
        try:
            user_feed = UserFeed.objects.get(
                user=user, 
                feed_id=feed_id, 
                pet=pet
            )
            user_feed.increment_usage()
            
            return Response({
                "message": "使用次數已更新",
                "usage_count": user_feed.usage_count,
                "last_used_at": user_feed.last_used_at
            }, status=status.HTTP_200_OK)
            
        except UserFeed.DoesNotExist:
            return Response({
                "error": "找不到該飼料記錄或寵物不匹配"
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                "error": f"更新使用次數失敗：{str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




class PetNutritionCalculator(APIView):
    permission_classes = [AllowAny]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    @swagger_auto_schema(
        operation_description="計算每日餵食量與營養素是否足夠（輸入每100g飼料的營養素含量）",
        manual_parameters=[
            openapi.Parameter('pet_type', openapi.IN_FORM, type=openapi.TYPE_STRING, required=True),
            openapi.Parameter('life_stage', openapi.IN_FORM, type=openapi.TYPE_STRING, required=True),
            openapi.Parameter('weight', openapi.IN_FORM, type=openapi.TYPE_NUMBER, required=True),
            openapi.Parameter('expected_adult_weight', openapi.IN_FORM, type=openapi.TYPE_NUMBER, required=False),
            openapi.Parameter('litter_size', openapi.IN_FORM, type=openapi.TYPE_INTEGER, required=False),
            openapi.Parameter('weeks_of_lactation', openapi.IN_FORM, type=openapi.TYPE_INTEGER, required=False),
            openapi.Parameter('protein', openapi.IN_FORM, type=openapi.TYPE_NUMBER, required=True),
            openapi.Parameter('fat', openapi.IN_FORM, type=openapi.TYPE_NUMBER, required=True),
            openapi.Parameter('carbohydrates', openapi.IN_FORM, type=openapi.TYPE_NUMBER, required=True),
            openapi.Parameter('calcium', openapi.IN_FORM, type=openapi.TYPE_NUMBER, required=True),
            openapi.Parameter('phosphorus', openapi.IN_FORM, type=openapi.TYPE_NUMBER, required=True),
            openapi.Parameter('magnesium', openapi.IN_FORM, type=openapi.TYPE_NUMBER, required=True),
            openapi.Parameter('sodium', openapi.IN_FORM, type=openapi.TYPE_NUMBER, required=True),
            openapi.Parameter('health_report', openapi.IN_FORM, type=openapi.TYPE_FILE, required=False, description='上傳 JSON 健康報告檔案'),
        ],
        responses={200: "成功"}
    )
    def post(self, request):
        data = request.data
        pet_id = data.get('pet_id')
        pet_type = data.get('pet_type')
        life_stage = data.get('life_stage')
        weight = float(data.get('weight'))
        expected_adult_weight = data.get('expected_adult_weight')
        litter_size = data.get('litter_size')
        weeks_of_lactation = data.get('weeks_of_lactation')

        # 飼料每 100 克含量（輸入）
        protein = float(data.get('protein'))
        fat = float(data.get('fat'))
        carbs = float(data.get('carbohydrates'))
        calcium = float(data.get('calcium'))
        phosphorus = float(data.get('phosphorus'))
        magnesium = float(data.get('magnesium'))
        sodium = float(data.get('sodium'))

        # 每100克飼料的代謝能
        ME_feed = (3.5 * protein) + (8.5 * fat) + (3.5 * carbs)

        # 每日熱量需求
        daily_ME = self.calculate_daily_energy(pet_type, life_stage, weight, expected_adult_weight, litter_size, weeks_of_lactation)

        # 建議攝取營養素
        recommended = self.calculate_recommended_nutrients(pet_type, daily_ME)

        # health_report_raw = request.FILES.get('health_report')
        health_data = []

        # if health_report_raw:
        #     try:
        #         # raw_json = json.load(health_report_raw)
        #         raw_json = json.load(io.TextIOWrapper(health_report_raw, encoding='utf-8'))
        #         if 'extracted_results' in raw_json:
        #             ocr_result = raw_json['extracted_results']
        #             health_data = convert_ocr_to_health_data(ocr_result)
        #         else:
        #             health_data = raw_json
        #     except json.JSONDecodeError:
        #         return Response({'error': '健康報告 JSON 格式錯誤。'}, status=status.HTTP_400_BAD_REQUEST)

        if pet_id:
            latest_report = HealthReport.objects.filter(pet_id=pet_id).order_by('-created_at').first()
            if latest_report:
                raw_json = latest_report.data
                if 'extracted_results' in raw_json:
                    ocr_result = raw_json['extracted_results']
                    health_data = convert_ocr_to_health_data(ocr_result)
                else:
                    health_data = raw_json



        ref_path = Path(__file__).resolve().parent / 'reference_ranges.json'
        with open(ref_path, 'r', encoding='utf-8') as f:
            reference_data = json.load(f)

        abnormal_items = self.find_abnormal_values(pet_type, life_stage, health_data, reference_data)
        adjusted_rec = self.adjust_recommendation_by_health(recommended, abnormal_items)

        # 飼料攝取量（克）
        feed_g_per_day = (daily_ME / ME_feed) * 100

        # 實際攝取量
        actual = {
            'protein': round(feed_g_per_day * protein / 100, 2),
            'fat': round(feed_g_per_day * fat / 100, 2),
            'calcium': round(feed_g_per_day * calcium / 100, 2),
            'phosphorus': round(feed_g_per_day * phosphorus / 100, 2),
            'magnesium': round(feed_g_per_day * magnesium / 100, 2),
            'sodium': round(feed_g_per_day * sodium / 100, 2),
        }

        # GPT 中文建議
        description = self.generate_description(
            pet_type, life_stage, weight, daily_ME, ME_feed,
            feed_g_per_day, adjusted_rec, actual, abnormal_items
        )

        return Response({
            "pet_type": pet_type,
            "life_stage": life_stage,
            "weight_kg": weight,
            "daily_ME_kcal": round(daily_ME, 2),
            "ME_per_100g_feed_kcal": round(ME_feed, 2),
            "daily_feed_amount_g": round(feed_g_per_day, 2),
            "recommended_nutrients": adjusted_rec,
            "actual_intake": actual,
            "abnormal_health_indicators": abnormal_items,
            "description": description
        }, status=status.HTTP_200_OK)

    def calculate_daily_energy(self, pet_type, stage, weight, expected_adult_weight, litter_size, weeks_of_lactation):
        if pet_type == 'dog':
            if stage == 'adult':
                return 130 * (weight ** 0.75)
            elif stage == 'pregnant':
                return 130 * (weight ** 0.75) + 26 * weight
            elif stage == 'lactating' and litter_size and weeks_of_lactation:
                return 145 * (weight ** 0.75) + weight * (24 * min(int(litter_size), 4) + 12 * max(0, int(litter_size) - 4)) * (int(weeks_of_lactation) / 4)
            elif stage == 'puppy' and expected_adult_weight:
                p = weight / float(expected_adult_weight)
                return 130 * (weight ** 0.75) * 3.2 * (math.exp(-0.87 * p) - 0.1)
        elif pet_type == 'cat':
            if stage == 'adult':
                return 100 * (weight ** 0.67)
            elif stage == 'pregnant':
                return 100 * (weight ** 0.67) * 1.25
            elif stage == 'lactating' and litter_size and weeks_of_lactation:
                return 100 * (weight ** 0.67) + (int(litter_size) * 18) * (int(weeks_of_lactation) / 7)
            elif stage == 'kitten' and expected_adult_weight:
                p = weight / float(expected_adult_weight)
                return 100 * (weight ** 0.67) * 6.7 * (math.exp(-0.189 * p) - 0.66)
        return 0

    def calculate_recommended_nutrients(self, pet_type, daily_ME):
        if pet_type == 'dog':
            return {
                'protein': round((50 / 1000) * daily_ME, 2),
                'fat': round((13.8 / 1000) * daily_ME, 2),
                'calcium': round((1 / 1000) * daily_ME, 2),
                'phosphorus': round((0.75 / 1000) * daily_ME, 2),
                'magnesium': round((150 / 1000 / 1000) * daily_ME, 4),
                'sodium': round((200 / 1000 / 1000) * daily_ME, 4),
            }
        elif pet_type == 'cat':
            return {
                'protein': round((65 / 1000) * daily_ME, 2),
                'fat': round((22.5 / 1000) * daily_ME, 2),
                'calcium': round((1 / 1000) * daily_ME, 2),
                'phosphorus': round((0.75 / 1000) * daily_ME, 2),
                'magnesium': round((140 / 1000 / 1000) * daily_ME, 4),
                'sodium': round((300 / 1000 / 1000) * daily_ME, 4),
            }
        return {}

    def find_abnormal_values(self, pet_type, stage, report, reference):
        result = {}
        stage_key = "幼年" if stage in ["puppy", "kitten"] else "成犬" if pet_type == "dog" else "成貓"
        ref_ranges = reference.get(pet_type, {}).get(stage_key, {})

        for item in report:
            name = item.get("英文名稱")
            value = item.get("檢查結果")

            if name in ref_ranges:
                low = ref_ranges[name].get("min")
                high = ref_ranges[name].get("max")

                if low is not None and value < low:
                    result[name] = "低於標準"
                elif high is not None and value > high:
                    result[name] = "高於標準"

        return result


    def adjust_recommendation_by_health(self, rec, abnormalities):
        rec = rec.copy()
        for item, status in abnormalities.items():
            if item in ["BUN", "Creatinine", "尿素氮", "肌酸酐"] and status == "高於標準":
                rec["protein"] = round(rec["protein"] * 0.8, 2)
            if item in ["ALT", "AST", "GPT", "肝酶"] and status == "高於標準":
                rec["fat"] = round(rec["fat"] * 0.9, 2)
            if item in ["Albumin", "白蛋白"] and status == "低於標準":
                rec["protein"] = round(rec["protein"] * 1.1, 2)
            if item in ["Calcium", "鈣"] and status == "低於標準":
                rec["calcium"] = round(rec["calcium"] * 1.2, 2)
        return rec
    

    def generate_description(self, pet_type, life_stage, weight, daily_ME, ME_feed, feed_amount, rec, actual, abnormal_items):
        try:
            abn_txt = "異常健康指標：\n" + "\n".join([f"- {k}: {v}" for k, v in abnormal_items.items()]) if abnormal_items else "無明顯異常指標。"
            message = (
                f"這是一隻{pet_type}，處於{life_stage}階段，體重{weight}公斤。\n"
                f"每日建議攝取 {round(daily_ME, 2)} kcal，飼料代謝能為 {round(ME_feed, 2)} kcal/100g。\n"
                f"建議每日餵食飼料 {round(feed_amount, 2)} 公克。\n\n"
                f"{abn_txt}\n\n"
                f"理想攝取量:\n"
                + "\n".join([f"- {k}: {v}g" for k, v in rec.items()]) +
                "\n實際攝取量:\n"
                + "\n".join([f"- {k}: {v}g" for k, v in actual.items()]) +
                "\n請先列出你的計算結果，包含一天飼料建議攝取量、各項營養素建議攝取量、和與飼料提供營養素量對比，若有健康報告，再根據健康報告給出微調建議。"
            )

            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "你是一名專業的寵物營養師。請用中文提供清楚、簡潔的分析報告。\n\n格式要求：\n1. 使用簡單的段落格式，每個主題間空一行\n2. 使用 '-' 開頭的條列式來列出營養數值\n3. 不要使用 **粗體**、*斜體*、表格或代碼區塊\n4. 數值資訊請用中文單位（公克、大卡）\n5. 內容應包含：每日飼料量、各項營養素建議量與實際量對比、健康建議"},
                    {"role": "user", "content": message}
                ],
                max_tokens=1500,
                temperature=0.5
            )
            return response.choices[0].message.content.strip()
        except APIError as e:
            return f"無法產生建議：API 錯誤 - {str(e)}"
        except Exception as e:
            return f"無法產生建議：{str(e)}"


class CompatibilityRedirectView(APIView):
    """向後兼容的重定向視圖"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        return Response({
            'message': '此 API 已遷移到 feeds app',
            'new_endpoints': {
                'shared_feeds': '/feeds/shared/',
                'create_feed': '/feeds/create/',
                'add_to_user': '/feeds/add-to-user/'
            }
        }, status=status.HTTP_301_MOVED_PERMANENTLY)
    
    def post(self, request):
        return Response({
            'message': '此 API 已遷移到 feeds app',
            'new_endpoints': {
                'shared_feeds': '/feeds/shared/',
                'create_feed': '/feeds/create/',
                'add_to_user': '/feeds/add-to-user/'
            }
        }, status=status.HTTP_301_MOVED_PERMANENTLY)