from django.urls import path
from .views import (
    FeedNutritionCalculatorAPIView, 
    UploadFeedAPIView, 
    RecentUsedFeedsAPIView,
    FeedProcessingStatusAPIView
)

# 標準化 API 路由
# 應用根路徑: /api/v1/feeds/
urlpatterns = [
    # 計算飼料營養
    path('calculator/', FeedNutritionCalculatorAPIView.as_view(), name='feed-calculator'),
    
    # 上傳飼料信息
    path('upload/', UploadFeedAPIView.as_view(), name='feed-upload'),
    
    # 獲取最近使用的飼料
    path('recent/', RecentUsedFeedsAPIView.as_view(), name='feed-recent'),
    
    # 獲取飼料處理狀態
    path('status/<int:feed_id>/', FeedProcessingStatusAPIView.as_view(), name='feed-status'),
]
