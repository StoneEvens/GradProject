from django.contrib import admin
from .models import AgentThread, AgentMessage


@admin.register(AgentThread)
class AgentThreadAdmin(admin.ModelAdmin):
    list_display = ['id', 'thread_id', 'user', 'title', 'created_at', 'updated_at', 'is_active']
    list_filter = ['is_active', 'created_at', 'updated_at']
    search_fields = ['thread_id', 'user__username', 'user__user_fullname', 'title']
    readonly_fields = ['thread_id', 'created_at', 'updated_at']
    list_per_page = 50
    
    fieldsets = (
        ('Thread Information', {
            'fields': ('thread_id', 'user', 'title')
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(AgentMessage)
class AgentMessageAdmin(admin.ModelAdmin):
    list_display = ['id', 'conversation', 'role', 'content_preview', 'created_at']
    list_filter = ['role', 'created_at']
    search_fields = ['content', 'conversation__title', 'conversation__user__username']
    readonly_fields = ['created_at']
    list_per_page = 100
    
    def content_preview(self, obj):
        return obj.content[:100] + '...' if len(obj.content) > 100 else obj.content
    content_preview.short_description = 'Content'
