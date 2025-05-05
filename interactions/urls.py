from django.urls import path
from .views import (
    CommentInteractionView,
    PostInteractionView,
    IllnessArchiveInteractionView
)

urlpatterns = [
    # 評論互動
    path('comments/<int:object_id>/interaction/', CommentInteractionView.as_view(), name='comment-interaction'),
    
    # 貼文互動
    path('posts/<int:object_id>/interaction/', PostInteractionView.as_view(), name='post-interaction'),
    
    # 疾病檔案互動
    path('illness-archives/<int:object_id>/interaction/', IllnessArchiveInteractionView.as_view(), name='illness-archive-interaction'),
] 