from django.urls import path
from .views import (
    UserPostsPreviewListAPIView, SearchAPIView, SearchSuggestionAPIView, 
    CreatePostAPIView, PostDetailAPIView, DeletePostAPIView, PostTagPetsAPIView, UserPostListAPIView, PostListAPIView,
    CheckAnnotationPermissionAPIView, ImageAnnotationListCreateAPIView, 
    ImageAnnotationDetailAPIView, PetRelatedPostsAPIView
)

urlpatterns = [
    # 貼文列表
    path('posts/', PostListAPIView.as_view(), name='posts-list'),
    
    # 用戶貼文相關
    path('users/<int:pk>/posts/preview/', UserPostsPreviewListAPIView.as_view(), name='user-posts-preview'),
    path('users/<int:pk>/posts/', UserPostListAPIView.as_view(), name='user-posts-list'),
    
    # 搜尋相關
    path('search/', SearchAPIView.as_view(), name='search'),
    path('search/suggestions/', SearchSuggestionAPIView.as_view(), name='search-suggestions'),
    
    # 貼文管理
    path('posts/create/', CreatePostAPIView.as_view(), name='create-post'),
    path('posts/<int:pk>/', PostDetailAPIView.as_view(), name='post-detail'),
    path('posts/<int:pk>/delete/', DeletePostAPIView.as_view(), name='delete-post'),
    path('posts/tag-pets/', PostTagPetsAPIView.as_view(), name='post-tag-pets'),
    
    # 圖片標註相關
    path('annotation/check-permission/<str:user_account>/', CheckAnnotationPermissionAPIView.as_view(), name='check-annotation-permission'),
    path('annotations/', ImageAnnotationListCreateAPIView.as_view(), name='annotation-list-create'),
    path('annotations/<int:annotation_id>/', ImageAnnotationDetailAPIView.as_view(), name='annotation-detail'),
    
    # 寵物相關貼文
    path('pets/<int:pet_id>/posts/', PetRelatedPostsAPIView.as_view(), name='pet-related-posts'),
]
