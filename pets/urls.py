from django.urls import path
from .views import *

urlpatterns = [
    path('illness-archives/popular-today/', TodayPopularIllnessArchiveAPIView.as_view(), name='today-popular-illness-archives'),
    path('my-pets/', UserPetsAPIView.as_view(), name='user_pets'),
    path('users/<int:pk>/archives/', UserIllnessArchiveListAPIView.as_view(), name='user-archives'),
    
]