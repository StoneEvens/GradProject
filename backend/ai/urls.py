from django.urls import path
from . import views

app_name = 'ai'

urlpatterns = [
    # Agent chat endpoint - intermediary between user and OpenAI Agent with MCP tools
    path('agent/chat', views.agent_chat, name='agent-chat'),
    
    # Main chat endpoint - compatible with aiChatService (mimics aiAgent format)
    path('chat/', views.main_chat, name='main-chat'),
    
    # Realtime session endpoint - for voice interaction with OpenAI Realtime API
    path('realtime/session/create/', views.create_realtime_session, name='create-realtime-session'),
    
    # Realtime tool execution endpoint - execute MCP tools for realtime agent
    path('realtime/execute-tool/', views.execute_realtime_tool, name='execute-realtime-tool'),
    
    # Conversation management endpoints
    path('conversations/create/', views.create_conversation, name='create-conversation'),
    path('conversations/', views.get_conversations, name='get-conversations'),
    path('conversations/<int:conversation_id>/', views.get_conversation_detail, name='get-conversation-detail'),
    path('conversations/<int:conversation_id>/update/', views.update_conversation, name='update-conversation'),
    path('conversations/<int:conversation_id>/delete/', views.delete_conversation, name='delete-conversation'),
    path('conversations/<int:conversation_id>/archive/', views.archive_conversation, name='archive-conversation'),
]
