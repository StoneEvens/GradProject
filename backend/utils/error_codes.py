"""
錯誤碼模塊

定義系統中使用的統一錯誤碼，便於前端處理各類錯誤情況
"""

class ErrorCodes:
    """系統錯誤碼定義類"""
    
    # 成功狀態碼 (200-299)
    SUCCESS = 200
    CREATED = 201
    ACCEPTED = 202
    
    # 客戶端錯誤碼 (400-499)
    BAD_REQUEST = 400                 # 一般性請求錯誤
    VALIDATION_ERROR = 40001          # 請求參數驗證失敗
    INVALID_PARAMETERS = 40002        # 無效的參數格式或值
    PARAMETER_MISSING = 40003         # 缺少必要參數
    PARAMETER_OUT_OF_RANGE = 40004    # 參數超出可接受範圍
    
    UNAUTHORIZED = 401                # 未授權訪問
    INVALID_CREDENTIALS = 40101       # 用戶憑證無效
    TOKEN_EXPIRED = 40102             # 認證令牌已過期
    TOKEN_INVALID = 40103             # 無效的認證令牌
    
    FORBIDDEN = 403                   # 禁止訪問
    PERMISSION_DENIED = 40301         # 權限不足
    ACCOUNT_DISABLED = 40302          # 帳號被禁用
    RATE_LIMITED = 40303              # 請求頻率超限
    
    NOT_FOUND = 404                   # 資源不存在
    RESOURCE_NOT_FOUND = 40401        # 具體資源不存在
    ENDPOINT_NOT_FOUND = 40402        # API端點不存在
    
    METHOD_NOT_ALLOWED = 405          # 方法不允許
    
    CONFLICT = 409                    # 資源衝突
    DUPLICATE_RESOURCE = 40901        # 嘗試創建已存在的資源
    RESOURCE_LOCKED = 40902           # 資源被鎖定，無法修改
    
    TOO_MANY_REQUESTS = 429           # 請求過多
    
    # 伺服器錯誤碼 (500-599)
    SERVER_ERROR = 500                # 伺服器內部錯誤
    DATABASE_ERROR = 50001            # 數據庫操作錯誤
    EXTERNAL_SERVICE_ERROR = 50002    # 外部服務調用錯誤
    
    SERVICE_UNAVAILABLE = 503         # 服務不可用
    MAINTENANCE = 50301               # 系統維護中
    RESOURCE_EXHAUSTED = 50302        # 系統資源耗盡
    
    # 業務邏輯錯誤碼 (600-699)
    FEED_ERROR = 600                  # 飼料相關錯誤
    FEED_PROCESSING_ERROR = 60001     # 飼料處理錯誤
    FEED_DATA_INCOMPLETE = 60002      # 飼料數據不完整
    FEED_IMAGE_ERROR = 60003          # 飼料圖片問題
    FEED_CALCULATION_ERROR = 60004    # 飼料計算錯誤
    
    PET_ERROR = 610                   # 寵物相關錯誤
    INVALID_PET_DATA = 61001          # 無效的寵物數據
    PET_NOT_FOUND = 61002             # 寵物不存在
    
    USER_ERROR = 620                  # 用戶相關錯誤
    INVALID_USER_DATA = 62001         # 無效的用戶數據
    USER_NOT_FOUND = 62002            # 用戶不存在
    
    MEDIA_ERROR = 630                 # 媒體處理錯誤
    INVALID_IMAGE = 63001             # 無效的圖片
    IMAGE_TOO_LARGE = 63002           # 圖片太大
    UNSUPPORTED_IMAGE_FORMAT = 63003  # 不支持的圖片格式
    IMAGE_PROCESSING_ERROR = 63004    # 圖片處理錯誤
    
    SOCIAL_ERROR = 640                # 社交功能相關錯誤
    POST_ERROR = 64001                # 發文相關錯誤
    COMMENT_ERROR = 64002             # 評論相關錯誤
    
    # 其他業務錯誤可繼續按照業務領域分類擴展...
    
    @classmethod
    def get_message(cls, code):
        """
        根據錯誤碼獲取默認的錯誤訊息
        
        Parameters:
        - code: 錯誤碼
        
        Returns:
        - str: 錯誤訊息
        """
        messages = {
            # 成功狀態碼
            cls.SUCCESS: "請求成功",
            cls.CREATED: "資源創建成功",
            cls.ACCEPTED: "請求已接受，正在處理中",
            
            # 客戶端錯誤
            cls.BAD_REQUEST: "請求參數錯誤",
            cls.VALIDATION_ERROR: "請求參數驗證失敗",
            cls.INVALID_PARAMETERS: "無效的參數格式或值",
            cls.PARAMETER_MISSING: "缺少必要參數",
            cls.PARAMETER_OUT_OF_RANGE: "參數超出可接受範圍",
            
            cls.UNAUTHORIZED: "未授權訪問",
            cls.INVALID_CREDENTIALS: "用戶憑證無效",
            cls.TOKEN_EXPIRED: "認證令牌已過期",
            cls.TOKEN_INVALID: "無效的認證令牌",
            
            cls.FORBIDDEN: "禁止訪問",
            cls.PERMISSION_DENIED: "權限不足",
            cls.ACCOUNT_DISABLED: "帳號已被禁用",
            cls.RATE_LIMITED: "請求頻率超限，請稍後再試",
            
            cls.NOT_FOUND: "資源不存在",
            cls.RESOURCE_NOT_FOUND: "請求的資源不存在",
            cls.ENDPOINT_NOT_FOUND: "API端點不存在",
            
            cls.METHOD_NOT_ALLOWED: "不支持的請求方法",
            
            cls.CONFLICT: "資源衝突",
            cls.DUPLICATE_RESOURCE: "資源已存在，無法創建重複資源",
            cls.RESOURCE_LOCKED: "資源被鎖定，暫時無法修改",
            
            cls.TOO_MANY_REQUESTS: "請求過於頻繁，請稍後再試",
            
            # 伺服器錯誤
            cls.SERVER_ERROR: "伺服器內部錯誤",
            cls.DATABASE_ERROR: "數據庫操作錯誤",
            cls.EXTERNAL_SERVICE_ERROR: "外部服務調用錯誤",
            
            cls.SERVICE_UNAVAILABLE: "服務暫時不可用",
            cls.MAINTENANCE: "系統維護中，請稍後再試",
            cls.RESOURCE_EXHAUSTED: "系統資源不足，請稍後再試",
            
            # 業務邏輯錯誤
            cls.FEED_ERROR: "飼料相關錯誤",
            cls.FEED_PROCESSING_ERROR: "飼料處理失敗",
            cls.FEED_DATA_INCOMPLETE: "飼料數據不完整",
            cls.FEED_IMAGE_ERROR: "飼料圖片問題",
            cls.FEED_CALCULATION_ERROR: "飼料計算錯誤",
            
            cls.PET_ERROR: "寵物相關錯誤",
            cls.INVALID_PET_DATA: "無效的寵物數據",
            cls.PET_NOT_FOUND: "寵物不存在",
            
            cls.USER_ERROR: "用戶相關錯誤",
            cls.INVALID_USER_DATA: "無效的用戶數據",
            cls.USER_NOT_FOUND: "用戶不存在",
            
            cls.MEDIA_ERROR: "媒體處理錯誤",
            cls.INVALID_IMAGE: "無效的圖片",
            cls.IMAGE_TOO_LARGE: "圖片尺寸過大",
            cls.UNSUPPORTED_IMAGE_FORMAT: "不支持的圖片格式",
            cls.IMAGE_PROCESSING_ERROR: "圖片處理失敗",
            
            cls.SOCIAL_ERROR: "社交功能相關錯誤",
            cls.POST_ERROR: "發文相關錯誤",
            cls.COMMENT_ERROR: "評論相關錯誤",
        }
        
        return messages.get(code, "未知錯誤") 