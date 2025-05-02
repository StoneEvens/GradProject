"""
自定義限流控制模組

實現不同 API 端點的限流策略，保護系統免受過度使用和濫用
"""

from rest_framework.throttling import UserRateThrottle, AnonRateThrottle

class BurstRateThrottle(UserRateThrottle):
    """
    短時間突發請求限流器
    
    用於防範快速反覆請求對系統造成的壓力
    """
    scope = 'burst'

class FeedUploadRateThrottle(UserRateThrottle):
    """
    飼料上傳限流器
    
    限制用戶上傳飼料的頻率，防止濫用圖片處理資源
    """
    scope = 'feed_upload'

class FeedCalculateRateThrottle(UserRateThrottle):
    """
    飼料營養計算限流器
    
    限制用戶計算飼料營養的頻率，確保計算資源合理使用
    """
    scope = 'feed_calculate'

class UserProfileRateThrottle(UserRateThrottle):
    """
    用戶資料請求限流器
    
    限制訪問用戶資料的頻率，保護用戶隱私和系統性能
    """
    scope = 'user_profile' 