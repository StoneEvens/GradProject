from django.urls import path
from calculator.views import (
    FeedListByUser, FeedCreateView, FeedUpdateView,
    PetNutritionCalculator, PetListByUser, PetCreateView, PetUpdateView
)

urlpatterns = [
    path('', PetNutritionCalculator.as_view(), name='calculator'),
    
    # Pet endpoints
    path('pets/', PetListByUser.as_view(), name="pet-list-by-user"),        
    path('pets/create/', PetCreateView.as_view(), name='pet-create'),
    path('pets/update/', PetUpdateView.as_view(), name='pet-update'),
    
    # Feed endpoints
    path('feeds/', FeedListByUser.as_view(), name="feed-list-by-user"),
    path('feeds/create/', FeedCreateView.as_view(), name="feed-create"),
    path('feeds/update/', FeedUpdateView.as_view(), name="feed-update"),
]
