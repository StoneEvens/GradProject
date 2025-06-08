from django.urls import path
from .views import ArticleRecommendationsView

urlpatterns = [
    path('', ArticleRecommendationsView.as_view(), name='article-recommendations'),
]