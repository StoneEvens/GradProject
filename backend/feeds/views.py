from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
import re

from google.cloud import vision
from google.oauth2 import service_account
from rest_framework.permissions import AllowAny
from utils.firebase_service import FirebaseStorageService
import os
from django.conf import settings

NUTRIENT_KEYWORDS = {
    'protein': ['protein', '蛋白', '粗蛋白'],
    'fat': ['fat', '脂肪', '粗脂肪'],
    'carbohydrate': ['carbohydrate', 'carb', '碳水', '碳水化合物', '纖維', '粗纖維'],
    'calcium': ['calcium', '鈣'],
    'phosphorus': ['phosphorus', '磷'],
    'magnesium': ['magnesium', '鎂'],
    'sodium': ['sodium', '鈉']
}

class FeedOCRView(APIView):
    permission_classes = [AllowAny]  
    parser_classes = (MultiPartParser, FormParser)

    @swagger_auto_schema(
        operation_description="上傳飼料包裝圖片，擷取營養標籤資訊（protein, fat 等）",
        manual_parameters=[
            openapi.Parameter(
                name="image",
                in_=openapi.IN_FORM,
                type=openapi.TYPE_FILE,
                required=True,
                description="上傳飼料背面圖片"
            )
        ],
        responses={200: openapi.Response('成功', schema=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'extracted_nutrients': openapi.Schema(type=openapi.TYPE_OBJECT)
            }
        ))}
    )
    def post(self, request, *args, **kwargs):
        credentials_path = os.path.join(settings.BASE_DIR, 'feeds', 'ai-project-454107-a1e8b881803e.json')

        uploaded_image = request.FILES.get('image')
        if not uploaded_image:
            return Response({'error': 'No image uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

        credentials = service_account.Credentials.from_service_account_file(credentials_path)
        client = vision.ImageAnnotatorClient(credentials=credentials)

        content = uploaded_image.read()
        image = vision.Image(content=content)

        response = client.text_detection(image=image)
        texts = response.text_annotations

        if response.error.message:
            return Response({'error': response.error.message}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        elif not texts:
            return Response({'extracted_nutrients': {}}, status=status.HTTP_200_OK)

        raw_text = texts[0].description
        extracted = self.extract_nutrients(raw_text)
        return Response({
            'raw_text': raw_text,
            'extracted_nutrients': extracted
        }, status=status.HTTP_200_OK)


    def extract_nutrients(self, text):
        # 整理文字
        text = text.replace('\n', ' ')
        text = re.sub(r'\s+', ' ', text)
        result = {}

        for field, keywords in NUTRIENT_KEYWORDS.items():
            matched = False
            for keyword in keywords:
                # 允許前後有雜訊，數字後面可能有 %
                pattern = rf"{keyword}.*?([\d\.]+)\s*%?"
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    try:
                        result[field] = float(match.group(1))
                        matched = True
                        break
                    except ValueError:
                        continue
            if not matched:
                result[field] = None  # 沒找到也標註
        return result
    
class FirebaseImageUploadView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file = request.FILES.get('file')
        user_id = request.data.get('user_id')
        feed_id = request.data.get('feed_id')
        photo_type = request.data.get('photo_type')

        if not file or not user_id or not feed_id or not photo_type:
            return Response({"error": "缺少必要欄位"}, status=status.HTTP_400_BAD_REQUEST)

        firebase = FirebaseStorageService()
        success, msg, url, firebase_path = firebase.upload_feed_photo(
            user_id=int(user_id),
            feed_id=int(feed_id),
            photo_file=file,
            photo_type=photo_type
        )

        if success:
            return Response({"message": "上傳成功", "download_url": url}, status=status.HTTP_200_OK)
        else:
            return Response({"error": f"上傳失敗：{msg}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)