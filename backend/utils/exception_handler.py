"""
全局異常處理模塊

提供統一的異常處理機制，將各種異常轉換為標準格式的 API 響應
"""

import logging
import traceback
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import DatabaseError, IntegrityError
from django.http import Http404
from rest_framework import exceptions
from rest_framework.views import set_rollback
from .api_response import APIResponse
from .error_codes import ErrorCodes

logger = logging.getLogger(__name__)

def custom_exception_handler(exc, context):
    """
    自定義異常處理函數
    
    將各種類型的異常轉換為標準的 API 響應格式
    
    Parameters:
    - exc: 發生的異常
    - context: 異常發生的上下文
    
    Returns:
    - APIResponse: 標準化的 API 響應
    """
    # 獲取視圖和請求信息，用於日誌記錄
    view_name = context.get('view').__class__.__name__ if context and 'view' in context else 'UnknownView'
    request_path = context.get('request').path if context and 'request' in context else 'unknown_path'
    user_id = context.get('request').user.id if context and 'request' in context and hasattr(context['request'], 'user') and hasattr(context['request'].user, 'id') else None
    
    # 記錄異常詳細信息到日誌
    logger.error(
        f"處理請求 '{request_path}' 時在視圖 '{view_name}' 中發生異常: {exc}",
        exc_info=True,
        extra={
            'view': view_name,
            'path': request_path,
            'user_id': user_id,
            'exception_class': exc.__class__.__name__,
            'exception_message': str(exc)
        }
    )
    
    # 回滾數據庫事務
    set_rollback()
    
    # 處理 REST framework 自帶的異常
    if isinstance(exc, exceptions.AuthenticationFailed):
        return APIResponse(
            message="身份驗證失敗",
            code=ErrorCodes.INVALID_CREDENTIALS,
            status=401
        )
        
    elif isinstance(exc, exceptions.NotAuthenticated):
        return APIResponse(
            message="未提供身份驗證憑證",
            code=ErrorCodes.UNAUTHORIZED,
            status=401
        )
        
    elif isinstance(exc, exceptions.PermissionDenied):
        return APIResponse(
            message="您沒有執行此操作的權限",
            code=ErrorCodes.PERMISSION_DENIED,
            status=403
        )
        
    elif isinstance(exc, exceptions.MethodNotAllowed):
        return APIResponse(
            message=f"請求方法 '{context['request'].method}' 不被允許",
            code=ErrorCodes.METHOD_NOT_ALLOWED,
            status=405
        )
        
    elif isinstance(exc, exceptions.NotFound):
        return APIResponse(
            message="請求的資源不存在",
            code=ErrorCodes.RESOURCE_NOT_FOUND,
            status=404
        )
        
    elif isinstance(exc, exceptions.ValidationError):
        # 處理 REST framework 的驗證錯誤
        error_details = exc.detail if hasattr(exc, 'detail') else {'error': str(exc)}
        return APIResponse(
            message="請求參數驗證失敗",
            code=ErrorCodes.VALIDATION_ERROR,
            data={'errors': error_details},
            status=400
        )
        
    elif isinstance(exc, exceptions.Throttled):
        # 處理請求頻率限制
        wait_time = exc.wait
        return APIResponse(
            message=f"請求過於頻繁，請等待 {wait_time} 秒後再試",
            code=ErrorCodes.RATE_LIMITED,
            data={'wait': wait_time},
            status=429
        )
    
    # 處理 Django 異常
    elif isinstance(exc, Http404):
        return APIResponse(
            message="請求的資源不存在",
            code=ErrorCodes.RESOURCE_NOT_FOUND,
            status=404
        )
        
    elif isinstance(exc, DjangoValidationError):
        # 處理 Django 的驗證錯誤
        error_message = exc.messages[0] if hasattr(exc, 'messages') and exc.messages else str(exc)
        return APIResponse(
            message=error_message,
            code=ErrorCodes.VALIDATION_ERROR,
            data={'errors': exc.message_dict if hasattr(exc, 'message_dict') else {'error': error_message}},
            status=400
        )
        
    elif isinstance(exc, DatabaseError):
        # 處理數據庫異常
        logger.error(f"數據庫錯誤: {str(exc)}", exc_info=True)
        return APIResponse(
            message="數據庫操作失敗",
            code=ErrorCodes.DATABASE_ERROR,
            status=500
        )
        
    elif isinstance(exc, IntegrityError):
        # 處理數據完整性異常
        return APIResponse(
            message="數據完整性錯誤",
            code=ErrorCodes.DUPLICATE_RESOURCE,
            status=409
        )
    
    # 處理自定義業務異常 (如果有)
    # 示例: 如果項目中實現了自定義異常類
    # elif isinstance(exc, CustomBusinessError):
    #     return APIResponse(
    #         message=str(exc),
    #         code=exc.code,
    #         status=200  # 業務錯誤通常使用 200 狀態碼
    #     )
    
    # 處理所有其他未處理的異常
    else:
        # 記錄完整的異常棧跟踪
        logger.critical(
            f"發生未處理的異常: {str(exc)}",
            exc_info=True,
            extra={
                'traceback': traceback.format_exc(),
                'view': view_name,
                'path': request_path
            }
        )
        
        # 生產環境中隱藏詳細錯誤信息
        from django.conf import settings
        if settings.DEBUG:
            error_detail = {
                'exception': exc.__class__.__name__,
                'detail': str(exc),
                'traceback': traceback.format_exc().split('\n')
            }
        else:
            error_detail = None
            
        return APIResponse(
            message="伺服器內部錯誤，請稍後再試",
            code=ErrorCodes.SERVER_ERROR,
            data=error_detail,
            status=500
        ) 