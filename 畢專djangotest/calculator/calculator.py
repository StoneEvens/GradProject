from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from openai import OpenAI, APIError
from dotenv import load_dotenv
import os, math, json
from pathlib import Path

# 載入 OpenAI API 金鑰
load_dotenv()
api_key = os.getenv('OPENAI_API_KEY')
client = OpenAI(api_key=api_key)

class PetNutritionCalculator(APIView):
    parser_classes = [FormParser, MultiPartParser]

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
        health_report_raw = request.FILES.get('health_report')
        health_data = json.load(health_report_raw) if health_report_raw else {}

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
                "\n請針對是否營養足夠與健康狀況，給出具體建議。"
            )

            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "你是一名專業的寵物營養師，會根據營養素建議值與健康報告提供餵食建議。"},
                    {"role": "user", "content": message}
                ],
                max_tokens=600,
                temperature=0.7
            )
            return response.choices[0].message.content.strip()
        except APIError as e:
            return f"無法產生建議：API 錯誤 - {str(e)}"
        except Exception as e:
            return f"無法產生建議：{str(e)}"
