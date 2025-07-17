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
from feeds.models import Feed
from .serializers import PetSerializer
from feeds.serializers import FeedSerializer
from django.contrib.auth import get_user_model
from rest_framework.permissions import AllowAny

User = get_user_model()

class PetListByUser(APIView):
    permission_classes = [AllowAny]  
    def get(self, request):
        user_id = request.query_params.get("user_id")
        if not user_id:
            return Response({"error": "請提供 user_id"}, status=status.HTTP_400_BAD_REQUEST)

        pets = Pet.objects.filter(owner=user_id)
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
        pet = Pet.objects.create(
            name=data.get("name"),
            is_dog=data.get("is_dog") in ['true', 'True', True],
            life_stage=data.get("life_stage"),
            weight=data.get("weight"),
            length=data.get("length"),
            expect_adult_weight=data.get("expect_adult_weight"),
            litter_size=data.get("litter_size"),
            weeks_of_lactation=data.get("weeks_of_lactation"),
            keeper_id=user
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

        for field in ["is_dog", "pet_avatar", "life_stage", "weight", "length", "expect_adult_weight", "litter_size", "weeks_of_lactation"]:
            value = request.data.get(field)
            if value is not None:
                setattr(pet, field, value)

        pet.save()

        return Response({
            "message": "更新成功",
            "pet_id": pet.id,
            "pet_avatar": pet.pet_avatar,
            "is_dog": pet.is_dog,
            "new_life_stage": pet.pet_stage,
            "new_weight": pet.weight,
            "new_length": pet.height,
            "new_expect_adult_weight": pet.predicted_adult_weight,
            "new_weeks_of_lacation": pet.weeks_of_lactation
        }, status=status.HTTP_200_OK)

class FeedListByUser(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        user_id = request.query_params.get("user_id")
        if not user_id:
            return Response({"error": "請提供 user_id"}, status=status.HTTP_400_BAD_REQUEST)

        feeds = Feed.objects.filter(user_id=user_id)
        serializer = FeedSerializer(feeds, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

class FeedCreateView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def post(self, request):
        data = request.data
        user_id = data.get("user_id")

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"error": "找不到使用者"}, status=status.HTTP_400_BAD_REQUEST)

        def parse_float(value):
            try:
                return float(value)
            except (TypeError, ValueError):
                return 0

        try:
            feed = Feed.objects.create(
                user=user,
                name=data.get("name"),
                brand=data.get("brand"),
                protein=parse_float(data.get("protein")),
                fat=parse_float(data.get("fat")),
                carbohydrate=parse_float(data.get("carbohydrate")),
                calcium=parse_float(data.get("calcium")),
                phosphorus=parse_float(data.get("phosphorus")),
                magnesium=parse_float(data.get("magnesium")),
                sodium=parse_float(data.get("sodium")),
                front_image_url=data.get("front_image_url"),
                nutrition_image_url=data.get("nutrition_image_url"),
            )

            return Response({
                "message": "飼料建立成功",
                "feed_id": feed.id,
                "data": FeedSerializer(feed).data
            }, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": f"建立 Feed 發生錯誤：{str(e)}"}, status=500)

class FeedUpdateView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def post(self, request):
        data = request.data
        feed_id = data.get("feed_id")

        if not feed_id:
            return Response({"error": "請提供 feed_id"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            feed = Feed.objects.get(id=feed_id)
        except Feed.DoesNotExist:
            return Response({"error": "找不到該飼料"}, status=status.HTTP_404_NOT_FOUND)

        def parse_float(value):
            try:
                return float(value)
            except (TypeError, ValueError):
                return 0

        try:
            # 更新欄位
            feed.name = data.get("name", feed.name)
            feed.brand = data.get("brand", feed.brand)
            feed.protein = parse_float(data.get("protein")) if "protein" in data else feed.protein
            feed.fat = parse_float(data.get("fat")) if "fat" in data else feed.fat
            feed.carbohydrate = parse_float(data.get("carbohydrate")) if "carbohydrate" in data else feed.carbohydrate
            feed.calcium = parse_float(data.get("calcium")) if "calcium" in data else feed.calcium
            feed.phosphorus = parse_float(data.get("phosphorus")) if "phosphorus" in data else feed.phosphorus
            feed.magnesium = parse_float(data.get("magnesium")) if "magnesium" in data else feed.magnesium
            feed.sodium = parse_float(data.get("sodium")) if "sodium" in data else feed.sodium
            feed.front_image_url = data.get("front_image_url", feed.front_image_url)
            feed.nutrition_image_url = data.get("nutrition_image_url", feed.nutrition_image_url)

            feed.save()

            return Response({
                "message": "飼料更新成功",
                "data": FeedSerializer(feed).data
            }, status=status.HTTP_200_OK)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": f"更新 Feed 發生錯誤：{str(e)}"}, status=500)

# 載入 OpenAI API 金鑰
load_dotenv()
api_key = os.getenv('OPENAI_API_KEY')
client = OpenAI(api_key=api_key)

def convert_ocr_to_health_data(ocr_result):
    FIELD_CHINESE_TO_ENGLISH = {
        "白血球計數": "WBC",
        "紅血球計數": "RBC",
        "血紅蛋白": "HGB",
        "血比容": "PCV",
        "平均紅血球體積": "MCV",
        "平均紅血球血紅蛋白量": "MCH",
        "平均紅血球血紅蛋白濃度": "MCHC",
        "紅血球分布寬度": "RDW",
        "嗜中性球計數": "Neutrophils",
        "淋巴球計數": "Lymphocytes",
        "單核球計數": "Monocytes",
        "嗜酸性球計數": "Eosinophils",
        "嗜鹼性球計數": "Basophils",
        "血小板計數": "Platelet",
        "網狀紅血球計數": "Reticulocytes",
        "白蛋白": "Albumin",
        "球蛋白": "Globulin",
        "總蛋白": "Total Protein",
        "丙氨酸轉氨酶": "ALT",
        "天門冬酸轉氨酶": "AST",
        "鹼性磷酸酶": "ALP",
        "血中尿素氮": "BUN",
        "肌酸酐": "Creatinine",
        "葡萄糖": "Glucose",
        "磷": "Phosphorus",
        "尿比重": "USG",
        "尿液酸鹼值": "Urine pH",
        "尿中紅血球": "Urine RBC",
        "尿中白血球": "Urine WBC",
        "尿蛋白／肌酐比值": "UPC",
        "總甲狀腺素": "T4",
        "胰臟特異性脂酶": "Pancreatic Lipase",
        "C-反應蛋白": "CRP",
        "血清淀粉樣蛋白A": "Serum Amyloid A"
    }

    converted = []
    for chinese_field, value_unit in ocr_result.items():
        if value_unit is None:
            continue
        english_field = FIELD_CHINESE_TO_ENGLISH.get(chinese_field)
        if not english_field:
            continue

        value_str = value_unit.get("result", "").replace(",", "")
        try:
            value = float(value_str)
        except ValueError:
            continue

        converted.append({
            "英文名稱": english_field,
            "檢查結果": value
        })
    return converted

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

        # 上傳健康報告
        # health_report_raw = request.FILES.get('health_report')
        # health_data = json.load(health_report_raw) if health_report_raw else {}
        # 讀取 OCR 結果 JSON
        # health_report_raw = request.FILES.get('health_report')
        # health_data = {}

        # if health_report_raw:
        #     raw_json = json.load(health_report_raw)

        #     # 判斷是否來自 OCR
        #     if 'extracted_results' in raw_json:
        #         ocr_result = raw_json['extracted_results']
        #         health_data = convert_ocr_to_health_data(ocr_result)
        #     else:
        #         health_data = raw_json
        health_report_raw = request.FILES.get('health_report')
        health_data = []

        if health_report_raw:
            try:
                # raw_json = json.load(health_report_raw)
                raw_json = json.load(io.TextIOWrapper(health_report_raw, encoding='utf-8'))
                if 'extracted_results' in raw_json:
                    ocr_result = raw_json['extracted_results']
                    health_data = convert_ocr_to_health_data(ocr_result)
                else:
                    health_data = raw_json
            except json.JSONDecodeError:
                return Response({'error': '健康報告 JSON 格式錯誤。'}, status=status.HTTP_400_BAD_REQUEST)




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


    # def find_abnormal_values(self, pet_type, stage, report, reference):
    #     result = {}
    #     stage_key = "幼年" if stage in ["puppy", "kitten"] else "成犬" if pet_type == "dog" else "成貓"
    #     ref_ranges = reference.get(pet_type, {}).get(stage_key, {})

    #     for key, value in report.items():
    #         if key in ref_ranges:
    #             low, high = ref_ranges[key]["min"], ref_ranges[key]["max"]
    #             if value < low:
    #                 result[key] = "低於標準"
    #             elif value > high:
    #                 result[key] = "高於標準"
    #     return result

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
                    {"role": "system", "content": "你是一名專業的寵物營養師，會用中文清楚、自然、口語化地說明寵物的營養分析與建議。請不要使用 LaTeX 公式或 Markdown 表格，直接用條列式或段落方式表達內容。"},
                    {"role": "user", "content": message}
                ],
                max_tokens=1500,
                temperature=0.7
            )
            return response.choices[0].message.content.strip()
        except APIError as e:
            return f"無法產生建議：API 錯誤 - {str(e)}"
        except Exception as e:
            return f"無法產生建議：{str(e)}"