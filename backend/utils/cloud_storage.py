"""
雲端儲存服務工具

TODO: [雲端存儲] 這個文件需要在雲端存儲服務準備好後實現
可以支持多種雲端存儲服務，如 AWS S3, Azure Blob Storage, Google Cloud Storage 等
"""

import os
import uuid
from datetime import datetime


class CloudStorageService:
    """
    雲端存儲服務的抽象基類
    為不同的雲端存儲提供商提供統一的接口
    """
    
    def upload_file(self, file_obj, folder_path=None, file_name=None):
        """
        上傳文件到雲端存儲
        
        Parameters:
        - file_obj: 文件對象或文件路徑
        - folder_path: 可選的存儲路徑
        - file_name: 可選的文件名
        
        Returns:
        - 可訪問的文件 URL
        """
        raise NotImplementedError("子類必須實現這個方法")
    
    def get_file(self, file_url):
        """
        從雲端存儲獲取文件
        
        Parameters:
        - file_url: 文件的 URL 或標識符
        
        Returns:
        - 文件內容或文件對象
        """
        raise NotImplementedError("子類必須實現這個方法")
    
    def delete_file(self, file_url):
        """
        從雲端存儲刪除文件
        
        Parameters:
        - file_url: 文件的 URL 或標識符
        
        Returns:
        - 操作是否成功
        """
        raise NotImplementedError("子類必須實現這個方法")


class S3StorageService(CloudStorageService):
    """
    Amazon S3 雲端存儲服務實現
    
    TODO: [雲端存儲] 實現 AWS S3 的存儲服務
    """
    
    def __init__(self, bucket_name, access_key=None, secret_key=None, region=None):
        """
        初始化 S3 存儲服務
        
        Parameters:
        - bucket_name: S3 桶名
        - access_key: AWS 訪問密鑰 ID
        - secret_key: AWS 秘密訪問密鑰
        - region: AWS 區域
        """
        self.bucket_name = bucket_name
        self.access_key = access_key
        self.secret_key = secret_key
        self.region = region
        # TODO: 初始化 S3 客戶端
    
    def upload_file(self, file_obj, folder_path=None, file_name=None):
        """
        上傳文件到 S3
        
        Parameters:
        - file_obj: 文件對象或文件路徑
        - folder_path: 可選的 S3 文件夾路徑
        - file_name: 可選的文件名
        
        Returns:
        - S3 URL
        """
        # TODO: 實現上傳到 S3 的邏輯
        pass
    
    def get_file(self, file_url):
        """
        從 S3 獲取文件
        
        Parameters:
        - file_url: S3 URL 或標識符
        
        Returns:
        - 文件內容或文件對象
        """
        # TODO: 實現從 S3 獲取文件的邏輯
        pass
    
    def delete_file(self, file_url):
        """
        從 S3 刪除文件
        
        Parameters:
        - file_url: S3 URL 或標識符
        
        Returns:
        - 操作是否成功
        """
        # TODO: 實現從 S3 刪除文件的邏輯
        pass


# 工廠函數，根據配置創建合適的存儲服務
def get_storage_service():
    """
    根據項目配置獲取合適的雲端存儲服務實例
    
    Returns:
    - CloudStorageService 的實例
    """
    # TODO: 根據 settings 中的配置決定使用哪種存儲服務
    # 目前只返回一個未實現的 S3 服務
    return S3StorageService(bucket_name="example-bucket")


# 生成唯一的文件名
def generate_unique_filename(original_filename):
    """
    生成唯一的文件名，避免文件名衝突
    
    Parameters:
    - original_filename: 原始文件名
    
    Returns:
    - 唯一的文件名
    """
    extension = os.path.splitext(original_filename)[1] if original_filename else ""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    unique_id = str(uuid.uuid4())[:8]
    
    return f"{timestamp}_{unique_id}{extension}" 