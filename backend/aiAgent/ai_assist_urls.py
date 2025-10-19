from django.urls import path
from .ai_assist_views import ai_assist, ai_status

urlpatterns = [
    path('assist/', ai_assist, name='ai_assist'),
    path('status/', ai_status, name='ai_status'),
]