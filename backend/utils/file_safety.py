"""
文件安全處理工具類

提供圖片安全檢查和處理功能，用於保護系統免受惡意文件攻擊
"""

import os
import magic
import imghdr
from PIL import Image as PILImage
from django.conf import settings
from io import BytesIO
import logging

logger = logging.getLogger(__name__)

# 安全圖片格式
SAFE_IMAGE_FORMATS = ['jpeg', 'jpg', 'png', 'webp']

# 安全 MIME 類型
SAFE_IMAGE_MIMETYPES = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
]

# 最大允許圖片尺寸 (像素)
MAX_IMAGE_DIMENSIONS = (5000, 5000)

# 最大允許文件大小 (字節) - 10MB
MAX_FILE_SIZE = 10 * 1024 * 1024

def validate_image_content(file_obj):
    """
    驗證文件內容是否為安全的圖片
    
    Parameters:
    - file_obj: 文件對象 (必須支持 read() 和 seek() 方法)
    
    Returns:
    - (bool, str): (是否安全, 錯誤消息)
    """
    current_position = file_obj.tell()
    try:
        # 檢查文件大小
        file_obj.seek(0, os.SEEK_END)
        file_size = file_obj.tell()
        file_obj.seek(0)
        
        if file_size > MAX_FILE_SIZE:
            return False, f"文件大小超過限制：{file_size} > {MAX_FILE_SIZE} 字節"
        
        # 讀取文件頭部用於檢測類型 (只讀取開頭一小部分)
        head = file_obj.read(2048)
        file_obj.seek(0)
        
        # 使用 python-magic 檢測 MIME 類型
        try:
            mime_type = magic.from_buffer(head, mime=True)
            if mime_type not in SAFE_IMAGE_MIMETYPES:
                return False, f"不支持的文件類型：{mime_type}"
        except Exception as e:
            logger.warning(f"MIME 類型檢測失敗: {str(e)}")
            # 即使 magic 庫失敗，也繼續使用其他方法檢查
        
        # 使用 imghdr 再次檢查文件類型
        file_content = file_obj.read()
        file_obj.seek(0)
        img_format = imghdr.what(None, file_content)
        if img_format not in SAFE_IMAGE_FORMATS:
            return False, f"不支持的圖片格式：{img_format}"
        
        # 嘗試使用 PIL 打開圖片，最終確認圖片有效性
        try:
            with PILImage.open(BytesIO(file_content)) as img:
                width, height = img.size
                # 檢查圖片尺寸
                if width > MAX_IMAGE_DIMENSIONS[0] or height > MAX_IMAGE_DIMENSIONS[1]:
                    return False, f"圖片尺寸過大：{width}x{height}"
                
                # 檢查圖片格式
                if img.format.lower() not in [f.lower() for f in SAFE_IMAGE_FORMATS]:
                    return False, f"不支持的圖片格式：{img.format}"
                
        except Exception as e:
            return False, f"無效的圖片文件：{str(e)}"
        
        return True, ""
        
    except Exception as e:
        return False, f"文件驗證過程出錯：{str(e)}"
    finally:
        # 確保文件指針恢復到原始位置
        try:
            file_obj.seek(current_position)
        except Exception:
            pass


def validate_image_file(file_path):
    """
    驗證磁盤上的圖片文件是否安全
    
    Parameters:
    - file_path: 文件路徑
    
    Returns:
    - (bool, str): (是否安全, 錯誤消息)
    """
    try:
        # 檢查文件是否存在
        if not os.path.exists(file_path):
            return False, f"文件不存在：{file_path}"
            
        # 檢查文件大小
        file_size = os.path.getsize(file_path)
        if file_size > MAX_FILE_SIZE:
            return False, f"文件大小超過限制：{file_size} > {MAX_FILE_SIZE} 字節"
            
        # 打開文件進行內容檢查
        with open(file_path, 'rb') as f:
            return validate_image_content(f)
            
    except Exception as e:
        return False, f"文件驗證過程出錯：{str(e)}"


def sanitize_image(file_obj, target_format='JPEG'):
    """
    對圖片進行安全處理，移除可能的惡意內容
    
    Parameters:
    - file_obj: 文件對象
    - target_format: 目標格式 ('JPEG', 'PNG', 'WEBP')
    
    Returns:
    - BytesIO: 處理後的文件內容
    """
    try:
        current_position = file_obj.tell()
        file_obj.seek(0)
        
        # 讀取文件內容
        file_content = file_obj.read()
        
        # 使用 PIL 打開並重新保存圖片，去除潛在的嵌入內容
        with PILImage.open(BytesIO(file_content)) as img:
            # 將圖片轉換為 RGB 模式（移除透明通道等）
            if img.mode != 'RGB' and target_format == 'JPEG':
                img = img.convert('RGB')
                
            # 限制圖片尺寸
            if img.width > MAX_IMAGE_DIMENSIONS[0] or img.height > MAX_IMAGE_DIMENSIONS[1]:
                img.thumbnail(MAX_IMAGE_DIMENSIONS, PILImage.LANCZOS)
                
            # 創建輸出緩衝區
            output = BytesIO()
            
            # 保存處理後的圖片
            img.save(output, format=target_format)
            output.seek(0)
            
            return output
    except Exception as e:
        logger.error(f"圖片淨化過程出錯：{str(e)}")
        raise
    finally:
        # 恢復文件指針位置
        try:
            file_obj.seek(current_position)
        except Exception:
            pass 