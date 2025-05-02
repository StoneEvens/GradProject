import os
import tempfile
from celery import shared_task
from django.core.files.base import ContentFile
from django.conf import settings
from django.db import transaction
from easyocr import Reader

from feeds.models import Feed
from media.models import Image
from feeds.views import extract_nutrition_info_for_chinese


@shared_task
def process_feed_ocr(feed_id, nutrition_image_temp_path, front_image_id, nutrition_image_id):
    """
    非同步處理上傳的飼料圖片並提取營養信息
    
    Parameters:
    - feed_id: 已創建的飼料記錄的 ID
    - nutrition_image_temp_path: 營養圖片的臨時存儲路徑
    - front_image_id: 正面圖片的 ID
    - nutrition_image_id: 營養圖片的 ID
    """
    try:
        # 獲取飼料對象
        feed = Feed.objects.get(id=feed_id)
        
        # 獲取圖像對象
        # TODO: [雲端存儲] 雲端實現後，這裡將獲取圖片URL而非本地路徑
        front_image = Image.objects.get(id=front_image_id)
        nutrition_image = Image.objects.get(id=nutrition_image_id)
        
        # 初始化 EasyOCR reader
        reader = Reader(['ch_sim', 'en'])

        # 從臨時文件讀取圖像並進行 OCR
        # TODO: [雲端存儲] 雲端實現後，可能需要從雲端URL直接獲取圖片數據
        # 或先下載到本地臨時文件再處理
        with open(nutrition_image_temp_path, 'rb') as f:
            nutrition_image_data = f.read()
        
        # 使用 EasyOCR 提取文本
        results = reader.readtext(nutrition_image_data)
        
        # 提取文本內容
        extracted_text = " ".join([text[1] for text in results])
        
        # 根據提取的文本更新飼料信息
        with transaction.atomic():
            # 提取營養信息
            nutrition_data = extract_nutrition_info_for_chinese(extracted_text)
            
            if nutrition_data:
                # 更新飼料信息
                feed.protein = nutrition_data.get('protein', 0)
                feed.fat = nutrition_data.get('fat', 0)
                feed.calcium = nutrition_data.get('calcium', 0)
                feed.phosphorus = nutrition_data.get('phosphorus', 0)
                feed.magnesium = nutrition_data.get('magnesium', 0)
                feed.sodium = nutrition_data.get('sodium', 0)
                feed.carbohydrate = nutrition_data.get('carbohydrate', 0)
            
            # 保存提取的文本
            feed.extracted_text = extracted_text
            feed.save()
            
        # 處理完成後刪除臨時文件
        if os.path.exists(nutrition_image_temp_path):
            os.remove(nutrition_image_temp_path)
            
        return {"status": "success", "feed_id": feed_id}
    
    except Exception as e:
        # 處理完成後確保刪除臨時文件
        if os.path.exists(nutrition_image_temp_path):
            os.remove(nutrition_image_temp_path)
        
        # 記錄錯誤並返回
        return {"status": "error", "message": str(e), "feed_id": feed_id} 