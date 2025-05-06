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
from feeds.utils import extract_nutrition_info_for_chinese
from utils.file_safety import validate_image_file, sanitize_image
from utils.image_service import ImageService

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
                
                # 使緩存失效
                ImageService.invalidate_image_cache(feed.id, Feed)
                
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
        
        # 執行 OCR 識別
        try:
            results = reader.readtext(nutrition_image_data)
        except Exception as ocr_error:
            error_msg = f"OCR 處理失敗: {str(ocr_error)}"
            logger.error(error_msg, exc_info=True)
            
            # 更新飼料處理狀態
            with transaction.atomic():
                feed.processing_status = "failed"
                feed.processing_error = error_msg
                feed.save()
                
                # 使緩存失效
                ImageService.invalidate_image_cache(feed.id, Feed)
                
            return {
                "status": "error", 
                "message": error_msg, 
                "feed_id": feed_id
            }
        
        # 提取識別出的文本
        logger.debug(f"從 OCR 結果中提取文本")
        extracted_text = ' '.join([result[1] for result in results])
        
        # 提取營養信息
        logger.debug(f"從文本中提取營養信息")
        nutrition_info, warnings = extract_nutrition_info_for_chinese(extracted_text)
        
        # 更新飼料記錄
        with transaction.atomic():
            feed.protein = nutrition_info.get('protein', 0)
            feed.fat = nutrition_info.get('fat', 0)
            feed.calcium = nutrition_info.get('calcium', 0)
            feed.phosphorus = nutrition_info.get('phosphorus', 0)
            feed.magnesium = nutrition_info.get('magnesium', 0)
            feed.sodium = nutrition_info.get('sodium', 0)
            feed.carbohydrate = nutrition_info.get('carbohydrate', 0)
            feed.extracted_text = extracted_text
            
            # 更新處理狀態
            if warnings:
                feed.processing_status = "completed_with_warnings"
                feed.processing_error = ', '.join(warnings)
            else:
                feed.processing_status = "completed"
                feed.processing_error = ""
                
            feed.save()
            
            # 使緩存失效
            ImageService.invalidate_image_cache(feed.id, Feed)
            
        # 清理臨時文件
        try:
            if os.path.exists(nutrition_image_temp_path):
                os.remove(nutrition_image_temp_path)
        except Exception as cleanup_error:
            logger.warning(f"清理臨時文件失敗: {str(cleanup_error)}")
        
        # 返回處理結果
        return {
            "status": "success", 
            "message": "營養信息提取完成", 
            "feed_id": feed_id,
            "nutrition_info": nutrition_info,
            "warnings": warnings
        }
        
    except Exception as e:
        logger.error(f"處理飼料 ID {feed_id} 的營養信息時發生錯誤: {str(e)}", exc_info=True)
        
        # 嘗試更新處理狀態
        try:
            with transaction.atomic():
                feed = Feed.objects.get(id=feed_id)
                feed.processing_status = "failed"
                feed.processing_error = f"處理時發生錯誤: {str(e)}"
                feed.save()
                
                # 使緩存失效
                ImageService.invalidate_image_cache(feed.id, Feed)
                
        except Exception as update_error:
            logger.error(f"更新飼料處理狀態時發生錯誤: {str(update_error)}", exc_info=True)
        
        # 如果還有重試次數，重試任務
        if self.request.retries < self.max_retries:
            logger.info(f"將重試任務，當前重試次數: {self.request.retries}")
            raise self.retry(exc=e)
            
        return {
            "status": "error", 
            "message": f"處理飼料營養信息失敗: {str(e)}", 
            "feed_id": feed_id
        } 