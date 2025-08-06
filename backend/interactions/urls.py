from django.urls import path
from . import views

urlpatterns = [
    # 貼文互動
    path('posts/<int:object_id>/interaction/', views.PostInteractionView.as_view(), name='post_interaction'),
    
    # 評論互動
    path('comments/<int:object_id>/interaction/', views.CommentInteractionView.as_view(), name='comment_interaction'),
    
    # 疾病檔案互動
    path('illness-archives/<int:object_id>/interaction/', views.IllnessArchiveInteractionView.as_view(), name='illness_archive_interaction'),
    
    # 獲取用戶按讚的貼文
    path('user/liked-posts/', views.UserLikedPostsView.as_view(), name='user_liked_posts'),
    
    # 獲取用戶收藏的貼文
    path('user/saved-posts/', views.UserSavedPostsView.as_view(), name='user_saved_posts'),
    
    # 獲取用戶按讚的疾病檔案
    path('user/liked-archives/', views.UserLikedArchivesView.as_view(), name='user_liked_archives'),
    
    # 獲取用戶收藏的疾病檔案
    path('user/saved-archives/', views.UserSavedArchivesView.as_view(), name='user_saved_archives'),
]