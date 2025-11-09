from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class AgentThread(models.Model):
    """
    Stores mapping between our DB conversations and OpenAI session IDs for continuity.

    OpenAI's Agents SDK (with store=True) persists message history server-side.
    We use Django's auto-increment 'id' as the local conversationId for the frontend.
    The 'thread_id' column stores the OpenAI continuation identifier (session_id).
    
    Note: Field name 'thread_id' is legacy; it actually holds the OpenAI session_id.
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
    
    Note: hasRecommendedUsers and hasRecommendedArticles flags are NOT stored.
    They are derived from the dictionaries in additional_data at runtime.
    """
    # Message roles
    ROLE_USER = 'user'
    ROLE_ASSISTANT = 'assistant'
    ROLE_SYSTEM = 'system'
    
    ROLE_CHOICES = [
        (ROLE_USER, 'User'),
        (ROLE_ASSISTANT, 'Assistant'),
        (ROLE_SYSTEM, 'System')
    ]
    
    # Relationships
    conversation = models.ForeignKey(
        AgentThread, 
        on_delete=models.CASCADE, 
        related_name='messages',
        verbose_name='Conversation'
    )
    
    # Message content
    role = models.CharField(
        max_length=20, 
        choices=ROLE_CHOICES,
        verbose_name='Role'
    )
    content = models.TextField(verbose_name='Message content')
    
    # Timestamp
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Created at')
    
    # AI response metadata (only for role=assistant)
    intent = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        verbose_name='Detected intent'
    )
    confidence = models.FloatField(
        null=True,
        blank=True,
        verbose_name='Confidence score'
    )
    source = models.CharField(
        max_length=50,
        default='mcp_agent',
        verbose_name='Response source'
    )
    
    # UI control flags (feature triggers)
    has_tutorial = models.BooleanField(
        default=False, 
        verbose_name='Has tutorial',
        help_text='Shows tutorial button'
    )
    tutorial_type = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        verbose_name='Tutorial type',
        help_text='health, training, nutrition, etc.'
    )
    has_calculator = models.BooleanField(
        default=False, 
        verbose_name='Has calculator',
        help_text='Shows calculator button'
    )
    operation_type = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        verbose_name='Operation type',
        help_text='navigate, fill_form, click, etc. (hasOperation derived from operations array in additional_data)'
    )
    
    # Additional data (JSON format) - stores dictionaries
    additional_data = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Additional data',
        help_text='Stores: recommendedUsers {}, recommendedSocialPosts {}, recommendedForumPosts {}, operations [], operationParams {}'
    )
    
    # Entity information
    entities = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Extracted entities',
        help_text='Pet breeds, symptoms, time ranges, etc.'
    )
    
    class Meta:
        db_table = 'ai_agent_messages'
        verbose_name = 'AI Agent Message'
        verbose_name_plural = 'AI Agent Messages'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['conversation', 'created_at']),
            models.Index(fields=['role']),
        ]
    
    def __str__(self):
        return f"{self.get_role_display()}: {self.content[:50]}..."
