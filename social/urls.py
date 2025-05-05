from django.urls import path
from .views import UserPostsPreviewListAPIView, SearchAPIView, SearchSuggestionAPIView, CreatePostAPIView, PostDetailAPIView, PostTagPetsAPIView, UserPostListAPIView

urlpatterns = [
    path('users/<int:pk>/posts/preview/', UserPostsPreviewListAPIView.as_view(), name='user-posts-preview'),
    path('users/<int:pk>/posts/', UserPostListAPIView.as_view(), name='user-posts-list'),
    path('search/', SearchAPIView.as_view(), name='search'),
    path('search/suggestions/', SearchSuggestionAPIView.as_view(), name='search-suggestions'),
    path('posts/create/', CreatePostAPIView.as_view(), name='create-post'),
    path('posts/<int:pk>/', PostDetailAPIView.as_view(), name='post-detail'),
    path('posts/tag-pets/', PostTagPetsAPIView.as_view(), name='post-tag-pets'),
]
