"""
AI Agent URL Configuration
"""

from django.urls import path
from .views import (
    AIAgentChatView,
    AIAgentHealthCheckView,
    ConversationListView,
    ConversationDetailView,
    ConversationCreateView,
    ConversationUpdateView,
    ConversationDeleteView,
    ConversationArchiveView,
    ConversationPinView,
    ConversationFeedbackView,
    DiseaseArchiveBatchView,
)

urlpatterns = [
    # AI 聊天
    path('chat/', AIAgentChatView.as_view(), name='ai-agent-chat'),
    path('health/', AIAgentHealthCheckView.as_view(), name='ai-agent-health'),

    # 對話管理
    path('conversations/', ConversationListView.as_view(), name='conversation-list'),
    path('conversations/create/', ConversationCreateView.as_view(), name='conversation-create'),
    path('conversations/<int:pk>/', ConversationDetailView.as_view(), name='conversation-detail'),
    path('conversations/<int:pk>/update/', ConversationUpdateView.as_view(), name='conversation-update'),
    path('conversations/<int:pk>/delete/', ConversationDeleteView.as_view(), name='conversation-delete'),
    path('conversations/<int:pk>/archive/', ConversationArchiveView.as_view(), name='conversation-archive'),
    path('conversations/<int:pk>/pin/', ConversationPinView.as_view(), name='conversation-pin'),

    # 對話回饋
    path('feedback/', ConversationFeedbackView.as_view(), name='conversation-feedback'),

    # 疾病檔案批量查詢
    path('disease-archives/batch/', DiseaseArchiveBatchView.as_view(), name='disease-archive-batch'),
]