from rest_framework.response import Response
from rest_framework import status as http_status

class APIResponse(Response):
    
    #統一的 API 響應格式
    
    def __init__(self, data=None, message="成功", code=None, status=None, **kwargs):
        """
        初始化 API 響應

        Args:
            data: 響應的主要數據
            message: 響應的文字消息
            code: 自定義業務狀態碼
            status: HTTP 狀態碼
            **kwargs: 其他額外字段
        """
        if status is None:
            status = http_status.HTTP_200_OK
            
        # 如果沒有提供自定義業務碼，使用 HTTP 狀態碼
        if code is None:
            code = status
            
        # 構建標準響應格式
        response_data = {
            "code": code,
            "message": message,
        }
        
        # 只有當 data 不為 None 時才添加到響應中
        if data is not None:
            response_data["data"] = data
            
        # 添加任何額外的鍵值對
        for key, value in kwargs.items():
            response_data[key] = value
            
        # 調用父類構造函數
        super().__init__(data=response_data, status=status) 