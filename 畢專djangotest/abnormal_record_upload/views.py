from rest_framework import viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import SymptomRecord
from .serializers import SymptomRecordSerializer

from datetime import datetime

from dotenv import load_dotenv
import os
from openai import OpenAI

# 讀取 .env
load_dotenv()
api_key = os.getenv('OPENAI_API_KEY')
client = OpenAI(api_key=api_key)

# 完整 CRUD（支援圖片上傳，ModelViewSet 自動處理 multipart/form-data）
class SymptomRecordViewSet(viewsets.ModelViewSet):
    queryset = SymptomRecord.objects.all()
    serializer_class = SymptomRecordSerializer

# 產生病程摘要
@api_view(['GET'])
def generate_summary(request):
    start = request.GET.get('start_date')
    end = request.GET.get('end_date')

    if not start or not end:
        return Response({'error': '請提供 start_date 與 end_date 參數'}, status=400)

    try:
        start_date = datetime.strptime(start, "%Y-%m-%d").date()
        end_date = datetime.strptime(end, "%Y-%m-%d").date()
    except ValueError:
        return Response({'error': '日期格式錯誤，請用 YYYY-MM-DD'}, status=400)

    records = SymptomRecord.objects.filter(record_date__range=(start_date, end_date)).order_by('record_date')

    if not records.exists():
        return Response({'error': '找不到任何紀錄'}, status=404)

    record_texts = []
    for record in records:
        text = f"日期：{record.record_date}\n"
        text += f"為就醫記錄：{'是' if record.for_medical else '否'}\n"
        text += f"症狀：{', '.join(record.symptoms)}\n"
        text += f"體重：{record.weight}公斤，喝水量：{record.water_intake}公升，體溫：{record.body_temperature}度\n"
        text += f"補充描述：{record.description}\n"
        record_texts.append(text)

    full_text = "\n\n".join(record_texts)

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "你是一位獸醫，請根據以下紀錄產出病程摘要："},
            {"role": "user", "content": full_text}
        ]
    )

    summary = response.choices[0].message.content
    return Response({'summary': summary})
