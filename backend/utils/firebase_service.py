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

    def upload_post_image(self, user_id: int, post_id: int, image_file, sort_order: int = 0) -> Tuple[bool, str, Optional[str], Optional[str]]:
        """
        上傳貼文圖片
        
        Parameters:
        - user_id: 用戶 ID
        - post_id: 貼文 ID  
        - image_file: 圖片檔案
        - sort_order: 圖片排序順序
        
        Returns:
        - tuple: (是否成功, 訊息, Firebase URL, Firebase 路徑)
        """
        try:
            # 生成貼文圖片的檔案路徑
            file_extension = image_file.name.split('.')[-1].lower() if '.' in image_file.name else 'jpg'
            unique_filename = f"post_{post_id}_{sort_order}_{uuid.uuid4().hex}.{file_extension}"
            file_path = f"posts/user_{user_id}/{unique_filename}"
            
            success, message, firebase_url = self.upload_image(image_file, file_path)
            
            if success:
                logger.info(f"貼文圖片上傳成功: post_id={post_id}, path={file_path}")
                return True, message, firebase_url, file_path
            else:
                logger.error(f"貼文圖片上傳失敗: post_id={post_id}, error={message}")
                return False, message, None, None
                
        except Exception as e:
            logger.error(f"上傳貼文圖片時發生錯誤: {str(e)}")
            return False, f"上傳貼文圖片失敗: {str(e)}", None, None

    def upload_post_images_batch(self, user_id: int, post_id: int, image_files: list) -> Tuple[bool, str, list]:
        """
        批量上傳貼文圖片
        
        Parameters:
        - user_id: 用戶 ID
        - post_id: 貼文 ID
        - image_files: 圖片檔案列表
        
        Returns:
        - tuple: (是否全部成功, 訊息, 成功上傳的圖片資訊列表)
        """
        uploaded_images = []
        failed_count = 0
        
        try:
            for index, image_file in enumerate(image_files):
                success, message, firebase_url, firebase_path = self.upload_post_image(
                    user_id=user_id,
                    post_id=post_id, 
                    image_file=image_file,
                    sort_order=index
                )
                
                if success:
                    uploaded_images.append({
                        'firebase_url': firebase_url,
                        'firebase_path': firebase_path,
                        'sort_order': index,
                        'original_filename': getattr(image_file, 'name', f'image_{index}'),
                        'file_size': getattr(image_file, 'size', None),
                        'content_type': getattr(image_file, 'content_type', None)
                    })
                else:
                    failed_count += 1
                    logger.error(f"圖片 {index} 上傳失敗: {message}")
            
            total_files = len(image_files)
            success_count = len(uploaded_images)
            
            if failed_count == 0:
                return True, f"所有 {total_files} 張圖片上傳成功", uploaded_images
            elif success_count > 0:
                return False, f"{success_count}/{total_files} 張圖片上傳成功，{failed_count} 張失敗", uploaded_images
            else:
                return False, f"所有 {total_files} 張圖片上傳失敗", uploaded_images
                
        except Exception as e:
            logger.error(f"批量上傳貼文圖片時發生錯誤: {str(e)}")
            return False, f"批量上傳失敗: {str(e)}", uploaded_images

    def delete_post_image(self, firebase_path: str) -> Tuple[bool, str]:
        """
        刪除貼文圖片
        
        Parameters:
        - firebase_path: Firebase Storage 檔案路徑
        
        Returns:
        - tuple: (是否成功, 訊息)
        """
        try:
            success, message = self.delete_image(firebase_path)
            if success:
                logger.info(f"貼文圖片刪除成功: {firebase_path}")
            else:
                logger.error(f"貼文圖片刪除失敗: {firebase_path}, error={message}")
            return success, message
        except Exception as e:
            logger.error(f"刪除貼文圖片時發生錯誤: {str(e)}")
            return False, f"刪除貼文圖片失敗: {str(e)}"

    def delete_post_images_batch(self, firebase_paths: list) -> Tuple[bool, str, dict]:
        """
        批量刪除貼文圖片
        
        Parameters:
        - firebase_paths: Firebase Storage 檔案路徑列表
        
        Returns:
        - tuple: (是否全部成功, 訊息, 詳細結果)
        """
        results = {
            'success': [],
            'failed': [],
            'total': len(firebase_paths)
        }
        
        try:
            for path in firebase_paths:
                if path:  # 確保路徑不為空
                    success, message = self.delete_post_image(path)
                    if success:
                        results['success'].append(path)
                    else:
                        results['failed'].append({'path': path, 'error': message})
            
            success_count = len(results['success'])
            failed_count = len(results['failed'])
            
            if failed_count == 0:
                return True, f"所有 {success_count} 張圖片刪除成功", results
            elif success_count > 0:
                return False, f"{success_count}/{results['total']} 張圖片刪除成功，{failed_count} 張失敗", results
            else:
                return False, f"所有 {results['total']} 張圖片刪除失敗", results
                
        except Exception as e:
            logger.error(f"批量刪除貼文圖片時發生錯誤: {str(e)}")
            return False, f"批量刪除失敗: {str(e)}", results


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

def cleanup_post_images(firebase_paths: list, logger=None) -> bool:
    """
    清理貼文圖片檔案的輔助函數
    
    Parameters:
    - firebase_paths: Firebase Storage 路徑列表
    - logger: 日誌記錄器 (可選)
    
    Returns:
    - bool: 是否全部成功刪除
    """
    if not firebase_paths:
        return True
    
    try:
        success, message, results = firebase_storage_service.delete_post_images_batch(firebase_paths)
        
        if logger:
            if success:
                logger.info(f"成功刪除所有貼文圖片: {len(firebase_paths)} 張")
            else:
                logger.warning(f"部分貼文圖片刪除失敗: {message}")
                for failed_item in results.get('failed', []):
                    logger.error(f"刪除失敗: {failed_item['path']} - {failed_item['error']}")
        
        return success
        
    except Exception as delete_error:
        if logger:
            logger.error(f"清理貼文圖片時發生錯誤: {str(delete_error)}")
        return False 