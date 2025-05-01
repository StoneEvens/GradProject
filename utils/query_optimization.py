from django.db import connection

def get_query_count():
    """
    獲取當前連接中已執行的查詢數量
    用於性能分析和調試
    """
    return len(connection.queries)

def log_queries(func):
    """
    裝飾器：紀錄視圖函數執行期間的數據庫查詢數量
    使用方法:
    
    @log_queries
    def get(self, request):
        # 視圖代碼...
        
    只在 DEBUG=True 時生效
    """
    def wrapper(*args, **kwargs):
        from django.conf import settings
        if not settings.DEBUG:
            return func(*args, **kwargs)
            
        queries_before = get_query_count()
        result = func(*args, **kwargs)
        queries_after = get_query_count()
        
        print(f"Function '{func.__name__}' executed {queries_after - queries_before} queries")
        
        return result
    return wrapper

def optimize_related_objects(queryset, *related_paths):
    """
    根據關係類型自動選擇 select_related 或 prefetch_related
    
    Args:
        queryset: 要優化的查詢集
        *related_paths: 關聯對象的路徑，如 'user', 'comments__user'
        
    Returns:
        優化後的查詢集
    
    用法:
    Pet.objects.all() |> optimize_related_objects('owner', 'illness_archives__illnesses')
    """
    from django.db.models import ForeignKey, OneToOneField
    
    select_related_fields = []
    prefetch_related_fields = []
    
    for path in related_paths:
        parts = path.split('__')
        model = queryset.model
        is_select_related = True
        
        for i, part in enumerate(parts):
            if not hasattr(model, part):
                # 可能是反向關係或 ManyToMany 字段
                is_select_related = False
                break
                
            field = model._meta.get_field(part)
            if not isinstance(field, (ForeignKey, OneToOneField)):
                is_select_related = False
                break
                
            if i < len(parts) - 1:
                model = field.related_model
        
        if is_select_related:
            select_related_fields.append(path)
        else:
            prefetch_related_fields.append(path)
    
    # 首先應用 select_related，然後是 prefetch_related
    if select_related_fields:
        queryset = queryset.select_related(*select_related_fields)
    if prefetch_related_fields:
        queryset = queryset.prefetch_related(*prefetch_related_fields)
        
    return queryset 