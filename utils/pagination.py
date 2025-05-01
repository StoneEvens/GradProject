from rest_framework.pagination import PageNumberPagination
from .api_response import APIResponse

class StandardResultsSetPagination(PageNumberPagination):
    
    #標準分頁類，使用統一的 API 響應格式
    
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100
    
    def get_paginated_response(self, data):
        return APIResponse(
            data=data,
            pagination={
                'count': self.page.paginator.count,
                'next': self.get_next_link(),
                'previous': self.get_previous_link(),
                'current_page': self.page.number,
                'total_pages': self.page.paginator.num_pages,
            }
        ) 