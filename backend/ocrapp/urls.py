from django.urls import path
from .views import *

urlpatterns = [
    path('create/', CreatePetAPIView.as_view(), name='create-pet'),
    path('<int:pet_id>/update/', UpdatePetAPIView.as_view(), name='update-pet'),
    path('illness-archives/popular-today/', TodayPopularIllnessArchiveAPIView.as_view(), name='today-popular-illness-archives'),
    path('my-pets/', UserPetsAPIView.as_view(), name='user_pets'),
    path('users/<int:pk>/archives/', UserIllnessArchiveListAPIView.as_view(), name='user-archives'),
    path('abnormal-posts/create/', CreateAbnormalPostAPIView.as_view(), name='create-abnormal-post'),
    path('symptoms/', SymptomListAPIView.as_view(), name='symptom-list'),
    path('my-abnormal-posts/', UserAbnormalPostListAPIView.as_view(), name='user-abnormal-posts'),
    path('<int:pet_id>/abnormal-posts/', PetAbnormalPostsAPIView.as_view(), name='pet-abnormal-posts'),
]