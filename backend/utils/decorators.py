"""
API 裝飾器

提供用於 API 視圖的各種裝飾器，包括日誌記錄、性能監控等
"""

import time
import logging
from functools import wraps
from django.db import connection, reset_queries
import threading

# 創建裝飾器專用的日誌記錄器
logger = logging.getLogger(__name__)

# 使用線程區域變數以支持並發請求
_thread_local = threading.local()

def log_queries(view_func):
    """
    日誌記錄查詢裝飾器
    
    記錄視圖函數執行期間的數據庫查詢數量和耗時，用於性能監控和優化
    """
    @wraps(view_func)
    def wrapped_view(self, request, *args, **kwargs):
        # 重置查詢計數器
        reset_queries()
        
        # 記錄開始時間
        start_time = time.time()
        
        # 初始化線程區域變數記錄調用層次
        if not hasattr(_thread_local, 'call_depth'):
            _thread_local.call_depth = 0
        
        # 增加調用深度（處理嵌套調用）
        _thread_local.call_depth += 1
        is_outermost_call = _thread_local.call_depth == 1
        
        # 為請求賦予唯一 ID，便於跟踪
        if is_outermost_call:
            request_id = hex(hash(time.time()))[2:10]
            logger.debug(f"[{request_id}] 開始處理請求 {request.method} {request.path}")
        
        try:
            # 執行視圖函數
            response = view_func(self, request, *args, **kwargs)
            return response
        finally:
            # 僅在最外層調用時記錄查詢信息
            if is_outermost_call:
                # 計算耗時
                duration = time.time() - start_time
                
                # 獲取查詢數量
                query_count = len(connection.queries)
                
                # 僅當查詢數量大於特定閾值時記錄詳細信息
                if query_count > 10:
                    logger.warning(
                        f"[{request_id}] {self.__class__.__name__}.{view_func.__name__} "
                        f"執行了 {query_count} 個查詢，耗時 {duration:.4f} 秒"
                    )
                else:
                    logger.info(
                        f"[{request_id}] {self.__class__.__name__}.{view_func.__name__} "
                        f"執行了 {query_count} 個查詢，耗時 {duration:.4f} 秒"
                    )
                
                # 對於極慢請求，記錄更詳細的信息（僅在開發環境）
                if duration > 1.0 and query_count > 0:
                    slow_queries = [
                        query for query in connection.queries 
                        if float(query.get('time', 0)) > 0.1
                    ]
                    if slow_queries:
                        logger.warning(
                            f"[{request_id}] 發現 {len(slow_queries)} 個慢查詢 "
                            f"(>0.1秒): {[q['sql'][:100] + '...' for q in slow_queries]}"
                        )
            
            # 減少調用深度
            _thread_local.call_depth -= 1
    
    return wrapped_view 