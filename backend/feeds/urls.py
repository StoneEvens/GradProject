from django.urls import path
from .views import (
    FeedOCRView, FeedReviewView, FeedErrorReportView, UserFeedMarkView,
    MyMarkedFeedsView, MyMarkedFeedsPreviewView, RecentlyUsedFeedsView, 
    AllFeedsView, AllFeedsPreviewView, CheckUserReviewView, FeedDetailView,
    FeedSearchView, CreateFeedView, UnifiedFeedCreateView, AddFeedToUserView
)

urlpatterns = [
    path('error-report/', FeedErrorReportView.as_view(), name='feed-error-report'),
    path('ocr/', FeedOCRView.as_view(), name='feed-ocr'),
    path('<int:feed_id>/review/', FeedReviewView.as_view(), name='feed-review'),
    path('mark/', UserFeedMarkView.as_view(), name='user-feed-mark'),
    
    # 三個固定顯示區域的 API
    path('my-marked/', MyMarkedFeedsView.as_view(), name='my-marked-feeds'),
    path('my-marked/preview/', MyMarkedFeedsPreviewView.as_view(), name='my-marked-feeds-preview'),
    path('recently-used/', RecentlyUsedFeedsView.as_view(), name='recently-used-feeds'),
    path('all/', AllFeedsView.as_view(), name='all-feeds'),
    path('all/preview/', AllFeedsPreviewView.as_view(), name='all-feeds-preview'),
    path('shared/', AllFeedsView.as_view(), name='shared-feeds'),  # 向後兼容原有的 shared API
    
    # 檢查審核狀態
    path('<int:feed_id>/check-review/', CheckUserReviewView.as_view(), name='check-user-review'),
    
    # 飼料詳情
    path('<int:feed_id>/', FeedDetailView.as_view(), name='feed-detail'),
    
    # 飼料搜尋
    path('search/', FeedSearchView.as_view(), name='feed-search'),
    
    # 新增飼料
    path('create/', UnifiedFeedCreateView.as_view(), name='unified-create-feed'),
    path('create/simple/', CreateFeedView.as_view(), name='create-feed'),  # 向後兼容
    
    # 將飼料加入使用者清單
    path('add-to-user/', AddFeedToUserView.as_view(), name='add-feed-to-user'),
]