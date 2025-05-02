from django.urls import path
from .views import (
    FeedNutritionCalculatorAPIView, 
    UploadFeedAPIView, 
    RecentUsedFeedsAPIView,
    FeedProcessingStatusAPIView
)

urlpatterns = [
    path('calculator/', FeedNutritionCalculatorAPIView.as_view(), name='feed-calculator'),
    path('upload/', UploadFeedAPIView.as_view(), name='feed-upload'),
    path('recent/', RecentUsedFeedsAPIView.as_view(), name='feed-recent'),
    path('status/<int:feed_id>/', FeedProcessingStatusAPIView.as_view(), name='feed-status'),
]
