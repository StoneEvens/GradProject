from django.urls import path
from .views import (
    PostCommentsView,
    CommentDetailView,
    CommentReplyView
)

urlpatterns = [
    path('post/<int:post_id>/comments/', PostCommentsView.as_view(), name='post-comments'),
    path('comments/<int:comment_id>/', CommentDetailView.as_view(), name='comment-detail'),
    path('comments/<int:comment_id>/replies/', CommentReplyView.as_view(), name='comment-replies'),
] 