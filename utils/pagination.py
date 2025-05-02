"""
標準分頁處理

提供統一的分頁機制，確保 API 響應格式一致
"""

from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from django.core.paginator import InvalidPage
from .api_response import APIResponse

class StandardResultsSetPagination(PageNumberPagination):
    """
    標準分頁類
    
    提供默認分頁大小、最大分頁大小和最小分頁大小限制
    分頁參數：
    - page: 頁碼，從1開始
    - page_size: 每頁數量，5-100之間
    """
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100
    min_page_size = 5
    
    def get_page_size(self, request):
        """
        獲取並驗證頁面大小
        
        確保頁面大小不低於最小限制
        """
        page_size = super().get_page_size(request)
        
        # 確保不低於最小頁面大小
        if page_size < self.min_page_size:
            return self.min_page_size
            
        return page_size
    
    def get_paginated_response(self, data):
        """
        返回統一格式的分頁響應
        
        使用 APIResponse 包裝分頁數據和元信息
        """
        return APIResponse(
            message="查詢成功",
            data={
                'count': self.page.paginator.count,
                'next': self.get_next_link(),
                'previous': self.get_previous_link(),
                'first': self.request.build_absolute_uri().split('?')[0] + '?page=1',
                'last': self.request.build_absolute_uri().split('?')[0] + f'?page={self.page.paginator.num_pages}',
                'current': self.request.build_absolute_uri(),
                'page': self.page.number,
                'pages': self.page.paginator.num_pages,
                'page_size': self.get_page_size(self.request),
                'results': data
            }
        )
    
    def paginate_queryset(self, queryset, request, view=None):
        """
        重寫 paginate_queryset 方法，添加更好的錯誤處理
        """
        page_size = self.get_page_size(request)
        if not page_size:
            return None
            
        paginator = self.django_paginator_class(queryset, page_size)
        page_number = request.query_params.get(self.page_query_param, 1)
        if page_number in self.last_page_strings:
            page_number = paginator.num_pages
            
        try:
            self.page = paginator.page(page_number)
        except InvalidPage as exc:
            # 處理頁面不存在的情況，返回第一頁或最後一頁
            page_number = int(page_number)
            if page_number > paginator.num_pages and paginator.num_pages > 0:
                self.page = paginator.page(paginator.num_pages)  # 返回最後一頁
            else:
                self.page = paginator.page(1)  # 返回第一頁
                
        self.request = request
        return list(self.page) 