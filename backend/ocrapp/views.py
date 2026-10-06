from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from .models import HealthReport
from pets.models import Pet
from rest_framework.permissions import AllowAny, IsAuthenticated

from .openai_vision import (
    OCRConfigurationError,
    OCRExtractionError,
    extract as run_vision_extraction,
)

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
                from datetime import datetime
                check_date = datetime.strptime(check_date_str, '%Y-%m-%d').date()
            except (ValueError, TypeError):
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

# ---------------------------------------------------------------------------
# Health report OCR
#
# Was Google Cloud Vision + regexes over the flattened page text. Vision needed
# a service-account JSON file that is not in the repo and not on the server, so
# this endpoint returned 500 for every upload.
#
# Now: one call to the OpenAI Responses API (see openai_vision.py). The model
# reads the report and returns the values already attached to their field
# names, which also fixes the old failure mode where `白血球.*?([\d\.]+)` picked
# up a number from a neighbouring row.
#
# The response shape is unchanged - {'extracted_results': {欄位: {result, unit}
# or null}} - so the frontend needs no edit.
# ---------------------------------------------------------------------------

# One line per field: the canonical name, then the names a lab might actually
# print. Built from FIELD_ALIASES so the two never drift apart.
_FIELD_HINTS = "\n".join(
    f"- {field}: {', '.join(aliases)}" for field, aliases in FIELD_ALIASES.items()
)

HEALTH_REPORT_INSTRUCTIONS = (
    "You read veterinary laboratory reports for pets and return the measured values.\n"
    "Report the number exactly as printed, including decimal points; never estimate, "
    "convert or infer a value, and never carry a value across from a different row.\n"
    "Reference ranges (for example '5.0 - 16.8') are not results: ignore them and "
    "report only the patient's own value.\n"
    "Omit a field entirely if it is absent, unreadable, or marked as pending.\n\n"
    "Each field below is followed by the labels a report might use for it:\n"
    f"{_FIELD_HINTS}"
)

HEALTH_REPORT_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["items"],
    "properties": {
        "items": {
            "type": "array",
            "description": "One entry per measurement found in the report.",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["field", "result", "unit"],
                "properties": {
                    # An enum means the model cannot invent a field name, so the
                    # mapping back to our keys needs no fuzzy matching.
                    "field": {"type": "string", "enum": list(FIELD_ALIASES.keys())},
                    "result": {"type": "string", "description": "The value as printed."},
                    "unit": {"type": "string", "description": "The unit as printed, or '' if none."},
                },
            },
        }
    },
}


class OCRUploadView(APIView):
    permission_classes = [AllowAny]
    parser_classes = (MultiPartParser, FormParser)

    @swagger_auto_schema(
        operation_description="上傳健康檢查報告（圖片或 PDF），辨識各項檢驗數值",
        manual_parameters=[
            openapi.Parameter('pet_id', openapi.IN_FORM, type=openapi.TYPE_INTEGER,
                              required=True, description='寵物 ID'),
            openapi.Parameter('image', openapi.IN_FORM, type=openapi.TYPE_FILE,
                              required=True, description='報告圖片或 PDF（欄位名 image 或 file 皆可）'),
        ],
        responses={200: '辨識成功', 400: '參數錯誤', 404: '找不到寵物', 503: '辨識服務未設定'}
    )
    def post(self, request, *args, **kwargs):
        pet_id = request.data.get('pet_id')
        if not pet_id:
            return Response({'error': '缺少 pet_id'}, status=status.HTTP_400_BAD_REQUEST)

        if not Pet.objects.filter(id=pet_id).exists():  # 只驗證，不建檔
            return Response({'error': '找不到寵物'}, status=status.HTTP_404_NOT_FOUND)

        # 兼容：優先 image，沒有就拿 file
        uploaded_file = request.FILES.get('image') or request.FILES.get('file')
        if not uploaded_file:
            return Response({'error': '沒有上傳檔案（image 或 file）'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            parsed = run_vision_extraction(
                uploaded_file,
                schema_name='health_report',
                schema=HEALTH_REPORT_SCHEMA,
                instructions=HEALTH_REPORT_INSTRUCTIONS,
                prompt='請讀出這份寵物檢驗報告中的檢驗項目與數值。',
            )
        except OCRConfigurationError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except OCRExtractionError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({'extracted_results': self.to_extracted_results(parsed)},
                        status=status.HTTP_200_OK)

    @staticmethod
    def to_extracted_results(parsed):
        """
        Turn the model's list of measurements into the dict the frontend expects:
        every canonical field present, each either {'result', 'unit'} or None.
        """
        results = {field: None for field in FIELD_ALIASES}

        for item in parsed.get('items') or []:
            field = item.get('field')
            value = (item.get('result') or '').strip()
            # Unknown field names cannot occur (the schema uses an enum), but a
            # blank value can: skip those rather than storing an empty string.
            if field not in results or not value:
                continue
            # First mention wins, so a summary table at the end of a multi-page
            # report does not overwrite the detailed page.
            if results[field] is None:
                results[field] = {'result': value, 'unit': (item.get('unit') or '').strip()}

        return results


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
        operation_description="獲取指定健康報告詳細資料",
        responses={200: "獲取成功", 404: "找不到報告"}
    )
    def get(self, request, report_id):
        try:
            report = HealthReport.objects.get(id=report_id)
            data = {
                "id": report.id,
                "pet_id": report.pet.id,
                "pet_name": report.pet.pet_name,
                "check_date": report.check_date.strftime("%Y-%m-%d") if report.check_date else "",
                "check_type": report.check_type,
                "check_location": report.check_location or "",
                "notes": report.notes or "",
                "created_at": report.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "data": report.data or {}
            }
            return Response(data, status=status.HTTP_200_OK)
        except HealthReport.DoesNotExist:
            return Response({'error': '找不到健康報告'}, status=status.HTTP_404_NOT_FOUND)

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
                from datetime import datetime
                # 直接解析 YYYY-MM-DD 格式的日期字串
                report.check_date = datetime.strptime(check_date_str, '%Y-%m-%d').date()
            except (ValueError, TypeError):
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