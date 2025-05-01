from django.urls import path
from .views import UserPostsPreviewListAPIView

urlpatterns = [
    path('users/<int:pk>/posts/preview/', UserPostsPreviewListAPIView.as_view(), name='user-posts-preview'),
]
