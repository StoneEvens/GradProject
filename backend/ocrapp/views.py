from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
import re
from .models import HealthReport
from pets.models import Pet
import io
from pdf2image import convert_from_bytes

from google.cloud import vision
from google.oauth2 import service_account
from rest_framework.permissions import AllowAny, IsAuthenticated

FIELD_ALIASES = {
    "白血球計數": ["白血球", "WBC", "白血球計數"],
    "紅血球計數": ["紅血球", "RBC", "紅血球計數"],
    "血紅蛋白": ["血紅蛋白", "血紅素", "HGB"],
    "血比容": ["血比容", "血比容 (紅血球壓積)", "PCV"],
    "平均紅血球體積": ["平均紅血球體積", "MCV"],
    "平均紅血球血紅蛋白量": ["平均紅血球血紅蛋白量", "MCH"],
    "平均紅血球血紅蛋白濃度": ["平均紅血球血紅蛋白濃度", "MCHC"],
    "紅血球分布寬度": ["紅血球分布寬度", "RDW"],
    "嗜中性球計數": ["嗜中性球計數", "Neutrophils (absolute)"],
    "淋巴球計數": ["淋巴球計數", "Lymphocytes (absolute)"],
    "單核球計數": ["單核球計數", "Monocytes (absolute)"],
    "嗜酸性球計數": ["嗜酸性球計數", "Eosinophils (absolute)"],
    "嗜鹼性球計數": ["嗜鹼性球計數", "Basophils (absolute)"],
    "血小板計數": ["血小板計數", "Platelet count", "PLT"],
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

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from .models import HealthReport
from pets.models import Pet
from datetime import datetime
import json
import traceback

class HealthReportListView(APIView):
    permission_classes = [AllowAny]
    def get(self, request):
        reports = HealthReport.objects.all().order_by('-created_at')
        data = []
        for r in reports:
            data.append({
                "id": r.id,
                "pet_name": r.pet.pet_name,
                "check_date": r.check_date.strftime("%Y-%m-%d") if r.check_date else "",
                "check_type": r.check_type,
                "check_location": r.check_location or "",
                "notes": r.notes or "",
                "created_at": r.created_at.strftime("%Y-%m-%d"),
                "data": r.data or {}
            })
        return Response(data, status=status.HTTP_200_OK)

class HealthReportUploadView(APIView):
    permission_classes = [AllowAny]
    """
    使用者提交健康報告表單，儲存到資料庫
    """
    @swagger_auto_schema(
        operation_description="提交健康報告表單",
        manual_parameters=[
            openapi.Parameter('pet_id', openapi.IN_FORM, type=openapi.TYPE_INTEGER, required=True, description='寵物 ID'),
            openapi.Parameter('check_date', openapi.IN_FORM, type=openapi.TYPE_STRING, required=True, description='檢查日期 (YYYY-MM-DD)'),
            openapi.Parameter('check_type', openapi.IN_FORM, type=openapi.TYPE_STRING, required=True, description='檢查類型 (cbc/biochemistry/urinalysis/other)'),
            openapi.Parameter('check_location', openapi.IN_FORM, type=openapi.TYPE_STRING, required=False, description='檢查地點'),
            openapi.Parameter('notes', openapi.IN_FORM, type=openapi.TYPE_STRING, required=False, description='備註'),
            openapi.Parameter('data', openapi.IN_FORM, type=openapi.TYPE_STRING, required=True, description='健康數據 (JSON)')
        ],
        responses={201: "上傳成功", 400: "參數錯誤"}
    )
    def post(self, request):
        try:
            pet_id = request.data.get('pet_id')
            check_date_str = request.data.get('check_date')
            check_type = request.data.get('check_type')
            check_location = request.data.get('check_location', '')
            notes = request.data.get('notes', '')
            data_raw = request.data.get('data')

            # 驗證 Pet
            try:
                pet = Pet.objects.get(id=pet_id)
            except Pet.DoesNotExist:
                return Response({'error': '找不到寵物'}, status=status.HTTP_404_NOT_FOUND)

            # 解析日期
            try:
                check_date = datetime.strptime(check_date_str, "%Y-%m-%d")
            except ValueError:
                return Response({'error': '日期格式錯誤，應為 YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)

            # 解析 JSON data
            try:
                data = json.loads(data_raw)
            except json.JSONDecodeError:
                return Response({'error': 'data 必須為有效的 JSON'}, status=status.HTTP_400_BAD_REQUEST)

            # 建立健康報告
            report = HealthReport.objects.create(
                pet=pet,
                check_date=check_date,
                check_type=check_type,
                check_location=check_location,
                notes=notes,
                data=data
            )

            return Response({'message': '上傳成功', 'report_id': report.id}, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# class OCRUploadView(APIView):
#     permission_classes = [AllowAny]
#     parser_classes = (MultiPartParser, FormParser)

#     def post(self, request, *args, **kwargs):
#         pet_id = request.data.get('pet_id')
#         if not pet_id:
#             return Response({'error': '缺少 pet_id'}, status=status.HTTP_400_BAD_REQUEST)

#         try:
#             Pet.objects.get(id=pet_id)  # 只驗證，不建檔
#         except Pet.DoesNotExist:
#             return Response({'error': '找不到寵物'}, status=status.HTTP_404_NOT_FOUND)

#         uploaded_image = request.FILES.get('image')
#         if not uploaded_image:
#             return Response({'error': '沒有上傳圖片'}, status=status.HTTP_400_BAD_REQUEST)

#         # OCR 流程
#         credentials_path = r"C:\Users\lxzhe\GradProject\backend\ocrapp\ai-project-454107-a1e8b881803e.json"
#         credentials = service_account.Credentials.from_service_account_file(credentials_path)
#         client = vision.ImageAnnotatorClient(credentials=credentials)

#         content = uploaded_image.read()
#         image = vision.Image(content=content)
#         response = client.text_detection(image=image)
#         texts = response.text_annotations

#         if response.error.message:
#             return Response({'error': response.error.message}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

#         raw_text = texts[0].description if texts else ""
#         extracted_data = self.extract_test_results(raw_text)

#         return Response({'extracted_results': extracted_data}, status=status.HTTP_200_OK)

#     def extract_test_results(self, text):
#         text = text.replace('\n', ' ')
#         text = re.sub(r'\s+', ' ', text)
#         result = {}

#         for field, aliases in FIELD_ALIASES.items():
#             matched = False
#             for alias in aliases:
#                 # 允許任意空白與符號，匹配數值和單位
#                 pattern = rf"{alias}.*?([\d\.]+)\s*([^\s]+)"
#                 match = re.search(pattern, text)
#                 if match:
#                     value = match.group(1)
#                     unit = match.group(2)
#                     result[field] = {
#                         "result": value,
#                         "unit": unit
#                     }
#                     matched = True
#                     break
#             if not matched:
#                 result[field] = None

#         return result
    

from pdf2image import convert_from_bytes
import io

class OCRUploadView(APIView):
    permission_classes = [AllowAny]
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        pet_id = request.data.get('pet_id')
        if not pet_id:
            return Response({'error': '缺少 pet_id'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            Pet.objects.get(id=pet_id)  # 只驗證，不建檔
        except Pet.DoesNotExist:
            return Response({'error': '找不到寵物'}, status=status.HTTP_404_NOT_FOUND)

        # 兼容：優先 image，沒有就拿 file
        uploaded_file = request.FILES.get('image') or request.FILES.get('file')
        if not uploaded_file:
            return Response({'error': '沒有上傳檔案（image 或 file）'}, status=status.HTTP_400_BAD_REQUEST)

        # ===== 保留你原本的金鑰寫法（可改為 .env，但這裡照舊）=====
        credentials_path = r"C:\Users\lxzhe\GradProject\backend\ocrapp\ai-project-454107-a1e8b881803e.json"
        credentials = service_account.Credentials.from_service_account_file(credentials_path)
        client = vision.ImageAnnotatorClient(credentials=credentials)
        # ========================================================

        content_type = (uploaded_file.content_type or "").lower()
        filename = (uploaded_file.name or "").lower()
        is_pdf = (content_type == "application/pdf") or filename.endswith(".pdf")

        try:
            if is_pdf:
                # ---------------- PDF → 逐頁轉圖片再 OCR（保留 text_detection 寫法） ----------------
                pdf_bytes = uploaded_file.read()
                # 300 dpi 較清楚；更高更清晰但較慢與較吃記憶體
                images = convert_from_bytes(pdf_bytes, dpi=300, fmt="jpeg")

                all_text = []
                for img in images:
                    buf = io.BytesIO()
                    img.save(buf, format="JPEG")
                    image = vision.Image(content=buf.getvalue())

                    # 照你舊寫法：text_detection + 取 texts[0].description
                    response = client.text_detection(
                        image=image,
                        image_context={"language_hints": ["zh", "en"]}  # 可有可無，但對中文常有幫助
                    )
                    if response.error.message:
                        return Response({'error': response.error.message}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

                    texts = response.text_annotations
                    page_text = texts[0].description if texts else ""
                    if page_text:
                        all_text.append(page_text)

                raw_text = "\n".join(all_text)
            else:
                # ---------------- 單張圖片（完全保留你原本流程） ----------------
                content = uploaded_file.read()
                image = vision.Image(content=content)
                response = client.text_detection(
                    image=image,
                    image_context={"language_hints": ["zh", "en"]}
                )
                if response.error.message:
                    return Response({'error': response.error.message}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

                texts = response.text_annotations
                raw_text = texts[0].description if texts else ""

            extracted_data = self.extract_test_results(raw_text)
            return Response({'extracted_results': extracted_data}, status=status.HTTP_200_OK)

        except Exception as e:
            # 維持簡潔的錯誤（避免曝露環境細節）；若想保留原樣也可回傳 str(e)
            traceback.print_exc()
            return Response({'error': 'OCR 處理失敗'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def extract_test_results(self, text):
        text = text.replace('\n', ' ')
        text = re.sub(r'\s+', ' ', text)
        result = {}

        for field, aliases in FIELD_ALIASES.items():
            matched = False
            for alias in aliases:
                # 允許任意空白與符號，匹配數值和單位（保留你原本 pattern）
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

class HealthReportDetailView(APIView):
    permission_classes = [AllowAny]

    @swagger_auto_schema(
        operation_description="更新指定健康報告",
        manual_parameters=[
            openapi.Parameter('check_date', openapi.IN_FORM, type=openapi.TYPE_STRING, required=False, description='檢查日期 (YYYY-MM-DD)'),
            openapi.Parameter('check_type', openapi.IN_FORM, type=openapi.TYPE_STRING, required=False, description='檢查類型 (cbc/biochemistry/urinalysis/other)'),
            openapi.Parameter('check_location', openapi.IN_FORM, type=openapi.TYPE_STRING, required=False, description='檢查地點'),
            openapi.Parameter('notes', openapi.IN_FORM, type=openapi.TYPE_STRING, required=False, description='備註'),
            openapi.Parameter('data', openapi.IN_FORM, type=openapi.TYPE_STRING, required=False, description='健康數據 (JSON)')
        ],
        responses={200: "更新成功", 404: "找不到報告", 400: "參數錯誤"}
    )
    def put(self, request, report_id):
        try:
            report = HealthReport.objects.get(id=report_id)
        except HealthReport.DoesNotExist:
            return Response({'error': '找不到健康報告'}, status=status.HTTP_404_NOT_FOUND)

        # 更新欄位（有傳才更新）
        check_date_str = request.data.get('check_date')
        if check_date_str:
            try:
                report.check_date = datetime.strptime(check_date_str, "%Y-%m-%d")
            except ValueError:
                return Response({'error': '日期格式錯誤，應為 YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)

        if 'check_type' in request.data:
            report.check_type = request.data.get('check_type') or None

        if 'check_location' in request.data:
            report.check_location = request.data.get('check_location') or ""

        if 'notes' in request.data:
            report.notes = request.data.get('notes') or ""

        if 'data' in request.data:
            try:
                report.data = json.loads(request.data.get('data'))
            except json.JSONDecodeError:
                return Response({'error': 'data 必須為有效的 JSON'}, status=status.HTTP_400_BAD_REQUEST)

        report.save()
        return Response({'message': '更新成功'}, status=status.HTTP_200_OK)

    @swagger_auto_schema(
        operation_description="刪除指定健康報告",
        responses={204: "刪除成功", 404: "找不到報告"}
    )
    def delete(self, request, report_id):
        try:
            report = HealthReport.objects.get(id=report_id)
            report.delete()
            return Response({'message': '刪除成功'}, status=status.HTTP_204_NO_CONTENT)
        except HealthReport.DoesNotExist:
            return Response({'error': '找不到健康報告'}, status=status.HTTP_404_NOT_FOUND)