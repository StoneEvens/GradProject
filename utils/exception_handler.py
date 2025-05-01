from rest_framework.views import exception_handler
from rest_framework import status
import logging
from .api_response import APIResponse

logger = logging.getLogger(__name__)

def custom_exception_handler(exc, context):
    
    #自定義異常處理器，統一處理 API 異常響應格式
    
    # 先調用 REST framework 默認的異常處理器
    response = exception_handler(exc, context)
    
    # 如果有 REST framework 能處理的異常
    if response is not None:
        # 獲取錯誤消息
        if isinstance(response.data, dict):
            message = next(iter(response.data.values())) if response.data else str(exc)
            if isinstance(message, list):
                message = message[0]
        else:
            message = str(exc)
        
        # 創建統一格式的響應
        response = APIResponse(
            code=response.status_code,
            message=message,
            status=response.status_code,
            errors=response.data
        )
    else:
        # 處理未捕獲的異常
        logger.error(f"未處理的異常: {str(exc)}", exc_info=True)
        response = APIResponse(
            code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message="服務器內部錯誤",
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    return response 