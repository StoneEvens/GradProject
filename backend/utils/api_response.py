"""
API 回應格式化模組

提供全局統一的 API 回應格式，確保所有 API 端點返回一致的結構
"""

from rest_framework.response import Response
from rest_framework import status as drf_status
from .error_codes import ErrorCodes
import logging

logger = logging.getLogger(__name__)

class APIResponse(Response):
    """
    標準 API 響應類
    
    提供統一的響應格式，包含狀態碼、消息和數據
    """
    
    def __init__(
        self, 
        data=None, 
        message="操作成功", 
        code=ErrorCodes.SUCCESS, 
        success=None,
        status=None, 
        template_name=None, 
        headers=None, 
        exception=False, 
        content_type=None,
        **kwargs
    ):
        """
        構造標準化 API 響應
        
        Parameters:
        - data: 響應數據
        - message: 響應消息
        - code: 業務狀態碼
        - success: 操作是否成功
        - status: HTTP 狀態碼
        - 其他參數: 傳遞給父類 Response
        """
        # 計算操作是否成功(如果未明確指定)
        if success is None:
            # 默認根據狀態碼判斷操作是否成功
            success = code < 400 if code is not None else True
        
        # 如果只提供了錯誤碼但沒有提供消息，使用默認錯誤消息
        if message == "操作成功" and code != ErrorCodes.SUCCESS:
            message = ErrorCodes.get_message(code)
        
        # 標準化 API 響應格式
        response_data = {
            "code": code,
            "message": message,
            "success": success,
        }
        
        # 只有在有數據時才添加數據字段
        if data is not None:
            response_data["data"] = data
            
        # 添加其他可能的字段
        for key, value in kwargs.items():
            response_data[key] = value
            
        # 如果沒有指定HTTP狀態碼，根據業務狀態碼推斷
        if status is None:
            # 對於業務錯誤碼，使用對應的HTTP狀態碼
            if code >= 600:
                # 業務錯誤統一返回 200 OK, 具體錯誤由業務碼標識 (以便於前端正常處理)
                http_status = drf_status.HTTP_200_OK
            elif 400 <= code < 600:
                # 客戶端和服務器錯誤使用對應的 HTTP 狀態碼
                http_status = code
            else:
                # 其他情況使用 200 OK
                http_status = drf_status.HTTP_200_OK
        else:
            http_status = status
            
        # 記錄錯誤狀態碼 (非 2xx 狀態)
        if code >= 400:
            log_level = logging.ERROR if code >= 500 else logging.WARNING
            logger.log(
                log_level, 
                f"API響應錯誤 - 錯誤碼: {code}, 消息: {message}", 
                extra={
                    "code": code,
                    "error_message": message,
                    "success": success
                }
            )
            
        super().__init__(
            data=response_data,
            status=http_status,
            template_name=template_name,
            headers=headers,
            exception=exception,
            content_type=content_type
        ) 