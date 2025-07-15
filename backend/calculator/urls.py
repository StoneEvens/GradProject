from django.urls import path
from calculator.views import (
    PetNutritionCalculator,
    PetListByUser, PetCreateView, PetUpdateView,
    FeedListByUser, FeedCreateView, FeedUpdateView,
)

urlpatterns = [
    # Nutrition calculator
    path('', PetNutritionCalculator.as_view(), name='calculator'),

    # Pet-related endpoints
    path('pets/', PetListByUser.as_view(), name='pet-list-by-user'),
    path('pets/create/', PetCreateView.as_view(), name='pet-create'),
    path('pets/update/', PetUpdateView.as_view(), name='pet-update'),

    # Feed-related endpoints
    path('feeds/', FeedListByUser.as_view(), name='feed-list-by-user'),
    path('feeds/create/', FeedCreateView.as_view(), name='feed-create'),
    path('feeds/update/', FeedUpdateView.as_view(), name='feed-update'),
]
