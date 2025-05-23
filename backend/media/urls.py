from django.urls import path
from .views import (
    ImageUploadAPIView,
    UserAvatarUploadAPIView,
    PetPhotoUploadAPIView,
    ImageDeleteAPIView
)

# 媒體API路由
urlpatterns = [
    # 通用圖片上傳
    path('upload/', ImageUploadAPIView.as_view(), name='image-upload'),
    
    # 用戶頭像相關
    path('avatar/', UserAvatarUploadAPIView.as_view(), name='user-avatar'),
    
    # 寵物照片相關
    path('pets/<int:pet_id>/photos/', PetPhotoUploadAPIView.as_view(), name='pet-photo-upload'),
    
    # 圖片刪除
    path('images/<int:image_id>/', ImageDeleteAPIView.as_view(), name='image-delete'),
] 