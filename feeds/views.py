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
from utils.query_optimization import log_queries

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
        data = request.data
        feed_id = data.get('feed_id')
        pet_info = data.get('pet_info')

        if not feed_id or not pet_info:
            return APIResponse(
                message="feed_id and pet_info are required.",
                code=status.HTTP_400_BAD_REQUEST,
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            feed = Feed.objects.get(id=feed_id)
        except Feed.DoesNotExist:
            return APIResponse(
                message="Feed not found.",
                code=status.HTTP_404_NOT_FOUND,
                status=status.HTTP_404_NOT_FOUND
            )

        # 取出pet基本資訊
        pet_type = pet_info['pet_type']
        weight = float(pet_info['weight'])
        pet_stage = pet_info['pet_stage']
        predicted_adult_weight = pet_info.get('predicted_adult_weight')
        illnesses = pet_info.get('illnesses', [])

        # Step 1: 計算飼料每100g的ME kcal
        me_per_100g = 3.5 * feed.protein + 8.5 * feed.fat + 3.5 * feed.carbohydrate

        # Step 2: 計算寵物每日ME需求
        if pet_type == 'dog':
            if pet_stage == 'adult':
                required_ME = 130 * math.pow(weight, 0.75)
            elif pet_stage == 'pregnant':
                required_ME = 130 * math.pow(weight, 0.75) + 26 * weight
            elif pet_stage == 'lactating':
                required_ME = 145 * math.pow(weight, 0.75)
            elif pet_stage == 'puppy':
                if not predicted_adult_weight:
                    return APIResponse(
                        message="predicted_adult_weight is required for puppies.",
                        code=status.HTTP_400_BAD_REQUEST,
                        status=status.HTTP_400_BAD_REQUEST
                    )
                p = weight / predicted_adult_weight
                required_ME = 130 * math.pow(weight, 0.75) * 3.2 * (math.exp(-0.87 * p) - 0.1)
        elif pet_type == 'cat':
            if pet_stage == 'adult':
                required_ME = 100 * math.pow(weight, 0.67)
            elif pet_stage == 'pregnant':
                required_ME = 100 * math.pow(weight, 0.67) * 1.35
            elif pet_stage == 'lactating':
                required_ME = 100 * math.pow(weight, 0.67)
            elif pet_stage == 'kitten':
                if not predicted_adult_weight:
                    return APIResponse(
                        message="predicted_adult_weight is required for kittens.",
                        code=status.HTTP_400_BAD_REQUEST,
                        status=status.HTTP_400_BAD_REQUEST
                    )
                p = weight / predicted_adult_weight
                required_ME = 100 * math.pow(weight, 0.67) * 6.7 * (math.exp(-0.189 * p) - 0.66)

        # Step 3: 計算每天應餵食多少克
        required_grams_per_day = (required_ME / me_per_100g) * 100

        # Step 4: 推算每天攝取到的營養量
        estimated_nutrition = {
            "protein": feed.protein * required_grams_per_day / 100,
            "fat": feed.fat * required_grams_per_day / 100,
            "calcium": feed.calcium * required_grams_per_day / 100,
            "phosphorus": feed.phosphorus * required_grams_per_day / 100,
            "magnesium": feed.magnesium * required_grams_per_day / 100,
            "sodium": feed.sodium * required_grams_per_day / 100,
        }

        UserFeed.objects.update_or_create(
            user=request.user,
            feed=feed,
            defaults={"last_used_date": timezone.now().date()}
        )

        result_data = {
            "feed_name": feed.feed_name,
            "calculated_ME_per_100g": round(me_per_100g, 2),
            "required_ME_per_day": round(required_ME, 2),
            "required_grams_per_day": round(required_grams_per_day, 2),
            "estimated_nutrition_intake": {k: round(v, 2) for k, v in estimated_nutrition.items()},
            "illnesses": illnesses
        }
        
        return APIResponse(
            data=result_data,
            message="營養計算完成"
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

# !圖片儲存位置待處理
#新增飼料
class UploadFeedAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    @log_queries
    def post(self, request):
        feed_name = request.data.get('feed_name')
        front_image_file = request.FILES.get('front_image')
        nutrition_image_file = request.FILES.get('nutrition_image')

        if not all([feed_name, front_image_file, nutrition_image_file]):
            return APIResponse(
                message="feed_name, front_image and nutrition_image are required.",
                code=status.HTTP_400_BAD_REQUEST,
                status=status.HTTP_400_BAD_REQUEST
            )

        # 1. 儲存正面產品照片
        front_image = Image.objects.create(img_url=front_image_file)

        # 2. 使用 EasyOCR 辨識成分表
        try:
            reader = easyocr.Reader(['ch_tra', 'en'])
            image_bytes = nutrition_image_file.read()
            img = PilImage.open(BytesIO(image_bytes)).convert("RGB")
            result_lines = reader.readtext(image_bytes, detail=0)
            ocr_text = "\n".join(result_lines)
        except Exception as e:
            return APIResponse(
                message=f"OCR failed: {str(e)}",
                code=status.HTTP_400_BAD_REQUEST,
                status=status.HTTP_400_BAD_REQUEST
            )

        # 3. 擷取營養成分
        nutrition_data = extract_nutrition_info_for_chinese(ocr_text)

        if not nutrition_data:
            return APIResponse(
                message="Failed to extract nutrition information from OCR.",
                code=status.HTTP_400_BAD_REQUEST,
                status=status.HTTP_400_BAD_REQUEST
            )

        # 4. 建立 Feed 物件
        feed = Feed.objects.create(
            feed_name=feed_name,
            protein=nutrition_data.get('protein', 0),
            fat=nutrition_data.get('fat', 0),
            calcium=nutrition_data.get('calcium', 0),
            phosphorus=nutrition_data.get('phosphorus', 0),
            magnesium=nutrition_data.get('magnesium', 0),
            sodium=nutrition_data.get('sodium', 0),
            carbohydrate=nutrition_data.get('carbohydrate', 0),
        )

        return APIResponse(
            data={
                "feed_id": feed.id,
                "front_image_id": front_image.id,
                "extracted_text": ocr_text,
                "nutrition_data": nutrition_data
            },
            message="飼料上傳和處理成功",
            status=status.HTTP_201_CREATED
        )

#顯示最近使用飼料
class RecentUsedFeedsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @log_queries
    def get(self, request):
        user = request.user

        # 使用 select_related 預加載 Feed 數據
        recent_user_feeds = UserFeed.objects.filter(user=user).select_related('feed').order_by('-last_used_date')[:8]

        if recent_user_feeds.exists():
            # 使用歷史紀錄
            feeds = [uf.feed for uf in recent_user_feeds]
            feed_ids = [uf.feed.id for uf in recent_user_feeds]
        else:
            # 第一次使用，隨機選取 8 筆 Feed
            all_feeds = list(Feed.objects.all())
            feeds = random.sample(all_feeds, min(8, len(all_feeds)))
            feed_ids = [feed.id for feed in feeds]

        # 一次性查詢所有相關圖片，而不是在循環中一個一個查詢
        feed_images = {}
        images = Image.objects.filter(
            content_type__model='feed', 
            object_id__in=feed_ids
        ).order_by('object_id', 'sort_order')
        
        # 將圖片按 feed_id 分組
        for image in images:
            if image.object_id not in feed_images:
                feed_images[image.object_id] = image.img_url

        # 查出每個 Feed 對應的 Image（正面照片）
        result = []
        for feed in feeds:
            result.append({
                "feed_id": feed.id,
                "feed_name": feed.feed_name,
                "feed_image_url": feed_images.get(feed.id)  # 使用預先查詢的圖片
            })

        return APIResponse(
            data=result,
            message="獲取最近使用的飼料成功"
        )
