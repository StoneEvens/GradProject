import os
import tempfile
from celery import shared_task
from django.core.files.base import ContentFile
from django.conf import settings
from django.db import transaction
from easyocr import Reader
import logging

from feeds.models import Feed
from media.models import Image
from feeds.views import extract_nutrition_info_for_chinese
from utils.file_safety import validate_image_file, sanitize_image

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def process_feed_ocr(self, feed_id, nutrition_image_temp_path, front_image_id, nutrition_image_id):
    """
    非同步處理上傳的飼料圖片並提取營養信息
    
    Parameters:
    - feed_id: 已創建的飼料記錄的 ID
    - nutrition_image_temp_path: 營養圖片的臨時存儲路徑
    - front_image_id: 正面圖片的 ID
    - nutrition_image_id: 營養圖片的 ID
    """
    try:
        # 記錄任務開始
        logger.info(f"開始處理飼料 ID {feed_id} 的營養信息")
        
        # 獲取飼料對象
        feed = Feed.objects.get(id=feed_id)
        
        # 獲取圖像對象
        # TODO: [雲端存儲] 雲端實現後，這裡將獲取圖片URL而非本地路徑
        front_image = Image.objects.get(id=front_image_id)
        nutrition_image = Image.objects.get(id=nutrition_image_id)
        
        # 對臨時文件進行安全檢查
        is_safe, error_message = validate_image_file(nutrition_image_temp_path)
        if not is_safe:
            error_msg = f"營養成分圖片安全檢查失敗: {error_message}"
            logger.error(error_msg)
            
            # 更新飼料處理狀態
            with transaction.atomic():
                feed.processing_status = "failed"
                feed.processing_error = error_msg
                feed.save()
                
            return {
                "status": "error", 
                "message": error_msg, 
                "feed_id": feed_id
            }
        
        # 初始化 EasyOCR reader
        logger.debug(f"初始化 EasyOCR reader")
        reader = Reader(['ch_sim', 'en'])

        # 從臨時文件讀取圖像並進行 OCR
        # TODO: [雲端存儲] 雲端實現後，可能需要從雲端URL直接獲取圖片數據
        # 或先下載到本地臨時文件再處理
        logger.debug(f"讀取營養成分圖片並進行 OCR")
        with open(nutrition_image_temp_path, 'rb') as f:
            nutrition_image_data = f.read()
        
        # 使用 EasyOCR 提取文本
        try:
            results = reader.readtext(nutrition_image_data)
            
            # 提取文本內容
            extracted_text = " ".join([text[1] for text in results])
            logger.debug(f"OCR 提取文本內容: {extracted_text[:100]}...")
            
        except Exception as e:
            error_msg = f"OCR 處理失敗: {str(e)}"
            logger.error(error_msg)
            
            # 更新飼料處理狀態
            with transaction.atomic():
                feed.processing_status = "failed"
                feed.processing_error = error_msg
                feed.save()
                
            return {
                "status": "error", 
                "message": error_msg, 
                "feed_id": feed_id
            }
        
        # 根據提取的文本更新飼料信息
        logger.debug(f"從提取的文本中解析營養成分信息")
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
                feed.processing_status = "completed"
            else:
                # 未能提取到足夠的營養信息
                warning_msg = "未能從圖片中提取足夠的營養信息"
                logger.warning(warning_msg)
                feed.processing_status = "completed_with_warnings"
                feed.processing_error = warning_msg
            
            # 保存提取的文本
            feed.extracted_text = extracted_text
            feed.save()
            
        # 處理完成後刪除臨時文件
        if os.path.exists(nutrition_image_temp_path):
            logger.debug(f"刪除臨時文件 {nutrition_image_temp_path}")
            os.remove(nutrition_image_temp_path)
            
        logger.info(f"飼料 ID {feed_id} 的營養信息處理完成")
        return {"status": "success", "feed_id": feed_id}
    
    except Exception as e:
        error_msg = f"處理飼料 ID {feed_id} 時發生錯誤: {str(e)}"
        logger.error(error_msg)
        
        # 如果重試次數未達上限，則重試
        try:
            # 處理完成後確保刪除臨時文件
            if os.path.exists(nutrition_image_temp_path):
                logger.debug(f"刪除臨時文件 {nutrition_image_temp_path}")
                os.remove(nutrition_image_temp_path)
            
            # 如果可以重試，則重試任務
            if self.request.retries < self.max_retries:
                logger.info(f"準備重試任務，當前重試次數: {self.request.retries}")
                self.retry(exc=e)
        except Exception as cleanup_error:
            logger.error(f"清理過程中發生錯誤: {str(cleanup_error)}")
        
        # 更新處理狀態
        try:
            with transaction.atomic():
                feed = Feed.objects.get(id=feed_id)
                feed.processing_status = "failed"
                feed.processing_error = str(e)
                feed.save()
        except Exception as update_error:
            logger.error(f"更新處理狀態時發生錯誤: {str(update_error)}")
        
        # 記錄錯誤並返回
        return {"status": "error", "message": str(e), "feed_id": feed_id} 