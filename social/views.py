from rest_framework import generics
from .models import Post
from .serializers import *
from rest_framework.permissions import IsAuthenticated
from utils.api_response import APIResponse

#使用者社群首頁post預覽圖
class UserPostsPreviewListAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PostPreviewSerializer

    def get_queryset(self):
        user_id = self.kwargs['pk']
        return Post.objects.filter(user_id=user_id).order_by('-created_at')

