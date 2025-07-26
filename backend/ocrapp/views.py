from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
import re
from .models import HealthReport
from pets.models import Pet

from google.cloud import vision
from google.oauth2 import service_account

FIELD_ALIASES = {
    "白血球計數": ["白血球", "白血球 (WBC)", "白血球計數"],
    "紅血球計數": ["紅血球", "紅血球 (RBC)", "紅血球計數"],
    "血紅蛋白": ["血紅蛋白", "血紅素", "血紅素 (HGB)"],
    "血比容": ["血比容", "血比容 (紅血球壓積)", "血比容 (PCV)"],
    "平均紅血球體積": ["平均紅血球體積", "MCV"],
    "平均紅血球血紅蛋白量": ["平均紅血球血紅蛋白量", "MCH"],
    "平均紅血球血紅蛋白濃度": ["平均紅血球血紅蛋白濃度", "MCHC"],
    "紅血球分布寬度": ["紅血球分布寬度", "RDW"],
    "嗜中性球計數": ["嗜中性球計數", "Neutrophils (absolute)"],
    "淋巴球計數": ["淋巴球計數", "Lymphocytes (absolute)"],
    "單核球計數": ["單核球計數", "Monocytes (absolute)"],
    "嗜酸性球計數": ["嗜酸性球計數", "Eosinophils (absolute)"],
    "嗜鹼性球計數": ["嗜鹼性球計數", "Basophils (absolute)"],
    "血小板計數": ["血小板計數", "Platelet count"],
    "網狀紅血球計數": ["網狀紅血球計數", "Reticulocytes (absolute)"],
    "白蛋白": ["白蛋白", "Albumin"],
    "球蛋白": ["球蛋白", "Globulin"],
    "總蛋白": ["總蛋白", "Total Protein"],
    "丙氨酸轉氨酶": ["丙氨酸轉氨酶", "ALT"],
    "天門冬酸轉氨酶": ["天門冬酸轉氨酶", "AST"],
    "鹼性磷酸酶": ["鹼性磷酸酶", "ALP"],
    "血中尿素氮": ["血中尿素氮", "BUN"],
    "肌酸酐": ["肌酸酐", "Creatinine"],
    "葡萄糖": ["葡萄糖", "Glucose"],
    "磷": ["磷", "Phosphorus"],
    "尿比重": ["尿比重", "Specific Gravity (USG)"],
    "尿液酸鹼值": ["尿液酸鹼值", "pH (urine)"],
    "尿中紅血球": ["尿中紅血球", "RBC (urine)"],
    "尿中白血球": ["尿中白血球", "WBC (urine)"],
    "尿蛋白／肌酐比值": ["尿蛋白／肌酐比值", "UPC"],
    "總甲狀腺素": ["總甲狀腺素", "T4 (Total Thyroxine)"],
    "胰臟特異性脂酶": ["胰臟特異性脂酶", "Pancreatic Lipase (cPL)", "Pancreatic Lipase (fPL)"],
    "C-反應蛋白": ["C-反應蛋白", "CRP"],
    "血清淀粉樣蛋白A": ["血清淀粉樣蛋白A", "Serum Amyloid A"]
}

class OCRUploadView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    @swagger_auto_schema(
        operation_description="上傳健康檢查報告圖片並擷取檢查結果",
        manual_parameters=[
            openapi.Parameter("pet_id", openapi.IN_FORM, type=openapi.TYPE_INTEGER, required=True, description="寵物 ID"),
            openapi.Parameter(
                name="image",
                in_=openapi.IN_FORM,
                type=openapi.TYPE_FILE,
                required=True,
                description="上傳報告圖片"
            )
        ],
        responses={200: openapi.Response('成功', schema=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'extracted_results': openapi.Schema(type=openapi.TYPE_OBJECT)
            }
        ))}
    )
    
    def post(self, request, *args, **kwargs):
        pet_id = request.data.get('pet_id')
        if not pet_id:
            return Response({'error': '缺少 pet_id'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            pet = Pet.objects.get(id=pet_id)
        except Pet.DoesNotExist:
            return Response({'error': '找不到寵物'}, status=status.HTTP_404_NOT_FOUND)

        uploaded_image = request.FILES.get('image')
        if not uploaded_image:
            return Response({'error': '沒有上傳圖片'}, status=status.HTTP_400_BAD_REQUEST)

        # OCR 流程
        credentials_path = r"C:\Users\lxzhe\GradProject\backend\ocrapp\ai-project-454107-a1e8b881803e.json"
        credentials = service_account.Credentials.from_service_account_file(credentials_path)
        client = vision.ImageAnnotatorClient(credentials=credentials)

        content = uploaded_image.read()
        image = vision.Image(content=content)
        response = client.text_detection(image=image)
        texts = response.text_annotations

        if response.error.message:
            return Response({'error': response.error.message}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        raw_text = texts[0].description if texts else ""
        extracted_data = self.extract_test_results(raw_text)

        # 存到資料庫
        HealthReport.objects.create(pet=pet, data={"extracted_results": extracted_data})

        return Response({'extracted_results': extracted_data}, status=status.HTTP_200_OK)

    def extract_test_results(self, text):
        text = text.replace('\n', ' ')
        text = re.sub(r'\s+', ' ', text)
        result = {}

        for field, aliases in FIELD_ALIASES.items():
            matched = False
            for alias in aliases:
                # 允許任意空白與符號，匹配數值和單位
                pattern = rf"{alias}.*?([\d\.]+)\s*([^\s]+)"
                match = re.search(pattern, text)
                if match:
                    value = match.group(1)
                    unit = match.group(2)
                    result[field] = {
                        "result": value,
                        "unit": unit
                    }
                    matched = True
                    break
            if not matched:
                result[field] = None

        return result

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
