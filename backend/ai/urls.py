from django.urls import path
from . import views

app_name = 'ai'

urlpatterns = [
    # Agent chat endpoint - intermediary between user and OpenAI Agent with MCP tools
    path('agent/chat', views.agent_chat, name='agent-chat'),
    
    # Main chat endpoint - compatible with aiChatService (mimics aiAgent format)
    path('chat/', views.main_chat, name='main-chat'),
    
    # Conversation management endpoints
    path('conversations/', views.get_conversations, name='get-conversations'),
    path('conversations/<int:conversation_id>/', views.get_conversation_detail, name='get-conversation-detail'),
    path('conversations/<int:conversation_id>/update/', views.update_conversation, name='update-conversation'),
    path('conversations/<int:conversation_id>/delete/', views.delete_conversation, name='delete-conversation'),
    path('conversations/<int:conversation_id>/archive/', views.archive_conversation, name='archive-conversation'),
]
