from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class AgentThread(models.Model):
    """
    Stores OpenAI Agent conversation IDs for conversation persistence
    
    OpenAI's store=True handles the actual message history on their servers.
    This model uses Django's auto-generated 'id' as the conversationId for the frontend,
    and stores the corresponding OpenAI conversation_id (starts with 'conv-').
    
    Note: thread_id field actually stores OpenAI conversation IDs (legacy naming).
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='agent_threads')
    thread_id = models.CharField(max_length=255, unique=True, help_text="OpenAI conversation ID (starts with 'conv-')")
    title = models.CharField(max_length=500, blank=True, default="New Conversation")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True, help_text="False if user deleted/archived")
    
    class Meta:
        db_table = 'ai_agent_threads'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', '-updated_at']),
            models.Index(fields=['thread_id']),
        ]
    
    def __str__(self):
        return f"Conversation {self.thread_id[:20]} - {self.user.username} - {self.title}"


class AgentMessage(models.Model):
    """
    Stores individual messages in conversations
    
    This allows us to display conversation history immediately without
    needing to fetch from OpenAI. OpenAI's store=True is still used
    as the source of truth for continuing conversations.
    """
    conversation = models.ForeignKey(AgentThread, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=20, choices=[
        ('user', 'User'),
        ('assistant', 'Assistant'),
        ('system', 'System')
    ])
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'ai_agent_messages'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['conversation', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.role}: {self.content[:50]}..."
