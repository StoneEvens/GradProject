from django.urls import path
from .views import *

urlpatterns = [
    path('pet-info/', GeneratePetInfoAPIView.as_view(), name='generate-pet-info'),
    path('calculate-nutrition/', FeedNutritionCalculatorAPIView.as_view(), name='calculate-nutrition'),
    path('upload-feed/', UploadFeedAPIView.as_view(), name='upload-feed'),
    path('recent-feeds/', RecentUsedFeedsAPIView.as_view(), name='recent_feeds'),
]
