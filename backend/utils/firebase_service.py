"""
Firebase Storage 服務模塊

提供 Firebase Storage 的圖片上傳、刪除等功能
"""

import os
import uuid
import logging
from typing import Optional, Tuple
from django.conf import settings
from django.core.files.uploadedfile import InMemoryUploadedFile, TemporaryUploadedFile

logger = logging.getLogger(__name__)


class FirebaseStorageService:
    """Firebase Storage 服務類"""
    
    # 支援的圖片格式
    SUPPORTED_IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'gif', 'webp']
    
    # 最大檔案大小 (5MB)
    MAX_FILE_SIZE = 5 * 1024 * 1024
    
    def __init__(self):
        """初始化 Firebase Storage 服務"""
        
        import firebase_admin
        from firebase_admin import credentials, storage
        
        if not firebase_admin._apps:
              cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
              firebase_admin.initialize_app(cred, {
                  'storageBucket': settings.FIREBASE_STORAGE_BUCKET
              })
        # 
        self.bucket = storage.bucket()
        pass
    
    def validate_image(self, image_file) -> Tuple[bool, str]:
        """
        驗證圖片檔案
        
        Parameters:
        - image_file: 上傳的圖片檔案
        
        Returns:
        - tuple: (是否有效, 錯誤訊息)
        """
        try:
            # 儲存當前檔案流位置
            original_position = None
            if hasattr(image_file, 'file') and hasattr(image_file.file, 'tell'):
                original_position = image_file.file.tell()
            elif hasattr(image_file, 'tell'):
                original_position = image_file.tell()
            
            # 檢查檔案大小
            if hasattr(image_file, 'size') and image_file.size > self.MAX_FILE_SIZE:
                return False, f"檔案大小超過限制 ({self.MAX_FILE_SIZE / 1024 / 1024:.1f}MB)"
            
            # 檢查檔案格式
            if hasattr(image_file, 'name'):
                file_extension = image_file.name.split('.')[-1].lower()
                if file_extension not in self.SUPPORTED_IMAGE_FORMATS:
                    return False, f"不支援的檔案格式，支援格式：{', '.join(self.SUPPORTED_IMAGE_FORMATS)}"
            
            # 檢查檔案內容類型
            if hasattr(image_file, 'content_type'):
                if not image_file.content_type.startswith('image/'):
                    return False, "檔案不是有效的圖片格式"
            
            # 恢復原始檔案流位置
            if original_position is not None:
                if hasattr(image_file, 'file') and hasattr(image_file.file, 'seek'):
                    image_file.file.seek(original_position)
                elif hasattr(image_file, 'seek'):
                    image_file.seek(original_position)
            
            return True, ""
            
        except Exception as e:
            logger.error(f"圖片驗證失敗: {str(e)}")
            return False, "圖片驗證失敗"
    
    def generate_file_path(self, folder: str, filename: str, user_id: Optional[int] = None) -> str:
        """
        生成 Firebase Storage 檔案路徑
        
        Parameters:
        - folder: 資料夾名稱 (如 'avatars', 'pets', 'feeds')
        - filename: 原始檔案名稱
        - user_id: 用戶 ID (可選)
        
        Returns:
        - str: Firebase Storage 檔案路徑
        """
        # 生成唯一檔案名稱
        file_extension = filename.split('.')[-1].lower() if '.' in filename else 'jpg'
        unique_filename = f"{uuid.uuid4().hex}.{file_extension}"
        
        # 構建路徑
        if user_id:
            return f"{folder}/user_{user_id}/{unique_filename}"
        else:
            return f"{folder}/{unique_filename}"
    
    def upload_image(self, image_file, file_path: str) -> Tuple[bool, str, Optional[str]]:
        """
        上傳圖片到 Firebase Storage
        
        Parameters:
        - image_file: 圖片檔案
        - file_path: Firebase Storage 檔案路徑
        
        Returns:
        - tuple: (是否成功, 錯誤訊息或成功訊息, Firebase URL)
        """
        try:
            # 驗證圖片
            is_valid, error_msg = self.validate_image(image_file)
            if not is_valid:
                return False, error_msg, None
            
            # 重置檔案流到開頭位置
            if isinstance(image_file, (InMemoryUploadedFile, TemporaryUploadedFile)):
                image_file.file.seek(0)
            else:
                image_file.seek(0)
            
            # 建立 blob 物件
            blob = self.bucket.blob(file_path)
            
            # 設定檔案內容類型
            if hasattr(image_file, 'content_type') and image_file.content_type:
                blob.content_type = image_file.content_type
            
            # 上傳檔案
            if isinstance(image_file, (InMemoryUploadedFile, TemporaryUploadedFile)):
                blob.upload_from_file(image_file.file)
            else:
                blob.upload_from_file(image_file)
            
            # 設定公開存取權限
            blob.make_public()
            
            # 獲取公開 URL
            firebase_url = blob.public_url
            
            logger.info(f"圖片上傳成功: {file_path}")
            return True, "圖片上傳成功", firebase_url
            
        except Exception as e:
            logger.error(f"圖片上傳失敗: {str(e)}")
            return False, f"圖片上傳失敗: {str(e)}", None
    
    def delete_image(self, file_path: str) -> Tuple[bool, str]:
        """
        從 Firebase Storage 刪除圖片
        
        Parameters:
        - file_path: Firebase Storage 檔案路徑
        
        Returns:
        - tuple: (是否成功, 訊息)
        """
        try:
            blob = self.bucket.blob(file_path)
            if blob.exists():
                blob.delete()
                logger.info(f"圖片刪除成功: {file_path}")
                return True, "圖片刪除成功"
            else:
                logger.warning(f"圖片不存在: {file_path}")
                return True, "圖片不存在，視為已刪除"
            
            
            
            # 暫時返回模擬結果
            logger.info(f"模擬圖片刪除: {file_path}")
            return True, "圖片刪除成功（模擬）"
            
        except Exception as e:
            logger.error(f"圖片刪除失敗: {str(e)}")
            return False, f"圖片刪除失敗: {str(e)}"
    
    def upload_user_avatar(self, user_id: int, avatar_file) -> Tuple[bool, str, Optional[str], Optional[str]]:
        """
        上傳用戶頭像
        
        Parameters:
        - user_id: 用戶 ID
        - avatar_file: 頭像檔案
        
        Returns:
        - tuple: (是否成功, 訊息, Firebase URL, Firebase 路徑)
        """
        file_path = self.generate_file_path('avatars', avatar_file.name, user_id)
        success, message, firebase_url = self.upload_image(avatar_file, file_path)
        
        if success:
            return True, message, firebase_url, file_path
        else:
            return False, message, None, None
    
    def upload_pet_photo(self, user_id: int, pet_id: int, photo_file, photo_type: str = 'general') -> Tuple[bool, str, Optional[str], Optional[str]]:
        """
        上傳寵物照片
        
        Parameters:
        - user_id: 用戶 ID
        - pet_id: 寵物 ID
        - photo_file: 照片檔案
        - photo_type: 照片類型 ('headshot' 或 'general')
        
        Returns:
        - tuple: (是否成功, 訊息, Firebase URL, Firebase 路徑)
        """
        folder = f"pets/user_{user_id}/pet_{pet_id}/{photo_type}"
        file_path = self.generate_file_path(folder, photo_file.name)
        success, message, firebase_url = self.upload_image(photo_file, file_path)
        
        if success:
            return True, message, firebase_url, file_path
        else:
            return False, message, None, None
    
    def upload_general_image(self, folder: str, image_file, user_id: Optional[int] = None) -> Tuple[bool, str, Optional[str], Optional[str]]:
        """
        上傳一般圖片
        
        Parameters:
        - folder: 資料夾名稱
        - image_file: 圖片檔案
        - user_id: 用戶 ID (可選)
        
        Returns:
        - tuple: (是否成功, 訊息, Firebase URL, Firebase 路徑)
        """
        file_path = self.generate_file_path(folder, image_file.name, user_id)
        success, message, firebase_url = self.upload_image(image_file, file_path)
        
        if success:
            return True, message, firebase_url, file_path
        else:
            return False, message, None, None


# 全域服務實例
firebase_storage_service = FirebaseStorageService()

def cleanup_old_headshot(old_firebase_path: str, logger=None) -> bool:
    """
    清理舊的頭像檔案的輔助函數
    
    Parameters:
    - old_firebase_path: 舊檔案的 Firebase Storage 路徑
    - logger: 日誌記錄器 (可選)
    
    Returns:
    - bool: 是否成功刪除
    """
    if not old_firebase_path:
        return True
    
    try:
        delete_success, delete_message = firebase_storage_service.delete_image(old_firebase_path)
        if delete_success:
            if logger:
                logger.info(f"成功刪除舊頭像檔案: {old_firebase_path}")
            return True
        else:
            if logger:
                logger.warning(f"刪除舊頭像檔案失敗: {delete_message}")
            return False
    except Exception as delete_error:
        if logger:
            logger.error(f"刪除舊頭像檔案時發生錯誤: {str(delete_error)}")
        return False 