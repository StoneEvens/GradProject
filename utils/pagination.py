from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from django.core.paginator import InvalidPage
from .api_response import APIResponse

class StandardResultsSetPagination(PageNumberPagination):
    """
    標準分頁類，使用統一的 API 響應格式
    
    提供：
    - 當前頁數據
    - 總記錄數
    - 總頁數
    - 當前頁號
    - 頁面大小
    - 首頁、上一頁、下一頁和最後一頁的鏈接
    """
    
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100
    min_page_size = 5  # 最小頁面大小，防止過小的分頁請求
    
    def get_page_size(self, request):
        """
        從請求中獲取頁面大小，並確保它不小於最小值
        """
        page_size = super().get_page_size(request)
        if page_size < self.min_page_size:
            return self.min_page_size
        return page_size
    
    def get_last_page_link(self):
        """
        獲取最後一頁的鏈接
        """
        if not self.page.has_next():
            return None
            
        url = self.request.build_absolute_uri()
        page_number = self.page.paginator.num_pages
        return self.replace_query_param(url, self.page_query_param, page_number)
    
    def get_first_page_link(self):
        """
        獲取第一頁的鏈接
        """
        if self.page.number == 1:
            return None
            
        url = self.request.build_absolute_uri()
        return self.replace_query_param(url, self.page_query_param, 1)
    
    def get_paginated_response(self, data):
        """
        返回統一格式的分頁響應
        """
        return APIResponse(
            data=data,
            pagination={
                'count': self.page.paginator.count,
                'next': self.get_next_link(),
                'previous': self.get_previous_link(),
                'first': self.get_first_page_link(),
                'last': self.get_last_page_link(),
                'current_page': self.page.number,
                'page_size': self.get_page_size(self.request),
                'total_pages': self.page.paginator.num_pages,
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