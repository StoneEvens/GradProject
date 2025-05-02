"""
全局異常處理器

提供統一的 API 異常處理邏輯，確保一致的錯誤響應格式
"""

import logging
from rest_framework.views import exception_handler
from rest_framework import exceptions
from rest_framework.exceptions import ValidationError
from django.db import IntegrityError
from django.core.exceptions import ObjectDoesNotExist
from utils.api_response import APIResponse

logger = logging.getLogger(__name__)

def custom_exception_handler(exc, context):
    """
    自定義異常處理器
    
    處理所有 DRF 和 Django 異常，返回統一格式的錯誤響應
    """
    # 首先使用 DRF 的默認處理
    response = exception_handler(exc, context)
    
    # 獲取請求路徑和視圖信息，用於日誌記錄
    request = context.get('request')
    view = context.get('view')
    
    path = request.path if request else "未知路徑"
    view_name = view.__class__.__name__ if view else "未知視圖"
    
    # 如果已經有了響應，我們需要調整其格式
    if response is not None:
        error_data = {}
        status_code = response.status_code
        
        # 處理驗證錯誤，為每個字段保留詳細信息
        if isinstance(exc, ValidationError):
            message = "參數驗證失敗"
            if isinstance(exc.detail, dict):
                for field, error_items in exc.detail.items():
                    error_data[field] = error_items
            else:
                error_data["detail"] = exc.detail
        # 處理其他 DRF 異常
        elif isinstance(exc, exceptions.APIException):
            message = str(exc)
        # 處理其他任何異常
        else:
            message = "服務器錯誤"
        
        # 使用統一的 APIResponse 格式
        return APIResponse(
            message=message,
            code=status_code,
            data=error_data if error_data else None
        )
    
    # 處理 DRF 未捕獲的常見 Django 異常
    if isinstance(exc, IntegrityError):
        logger.error(f"數據庫完整性錯誤: {str(exc)} - 路徑: {path}, 視圖: {view_name}")
        return APIResponse(
            message="數據已存在或違反資料庫完整性約束",
            code=400
        )
    
    if isinstance(exc, ObjectDoesNotExist):
        logger.error(f"對象不存在: {str(exc)} - 路徑: {path}, 視圖: {view_name}")
        return APIResponse(
            message="請求的資源不存在",
            code=404
        )
    
    # 處理所有其他未捕獲的異常
    logger.exception(
        f"未處理的異常: {exc.__class__.__name__}: {str(exc)} - 路徑: {path}, 視圖: {view_name}",
        exc_info=exc
    )
    
    # 為任何未處理的異常返回統一的服務器錯誤響應
    return APIResponse(
        message="服務器內部錯誤，請稍後再試",
        code=500
    ) 