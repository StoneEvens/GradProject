from django.urls import path
from calculator.views import (
    PetNutritionCalculator, FeedUsageTracker,
    PetListByUser, PetCreateView, PetUpdateView,
    FeedListByUser, FeedUpdateView, CompatibilityRedirectView
)

urlpatterns = [
    # Nutrition calculator
    path('calculation/', PetNutritionCalculator.as_view(), name='calculator'),
    path('feeds/usage/', FeedUsageTracker.as_view(), name='feed-usage-tracker'),

    # Pet-related endpoints
    path('pets/', PetListByUser.as_view(), name='pet-list-by-user'),
    path('pets/create/', PetCreateView.as_view(), name='pet-create'),
    path('pets/update/', PetUpdateView.as_view(), name='pet-update'),

    # Feed-related endpoints (UserFeed - 使用者的飼料清單)
    path('feeds/', FeedListByUser.as_view(), name='feed-list-by-user'),
    path('feeds/validate/', FeedUpdateView.as_view(), name='feed-validate'),
    
    # 向後兼容的重定向路由
    path('feeds/shared/', CompatibilityRedirectView.as_view(), name='shared-feed-list-compat'),
    path('feeds/create/', CompatibilityRedirectView.as_view(), name='feed-create-compat'),
    path('feeds/add/', CompatibilityRedirectView.as_view(), name='add-existing-feed-compat'),
]
