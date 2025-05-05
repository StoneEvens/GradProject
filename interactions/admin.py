from django.contrib import admin
from .models import UserInteraction

class UserInteractionAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'content_type', 'object_id', 'relation', 'created_at')
    list_filter = ('relation', 'content_type', 'created_at')
    search_fields = ('user__username', 'object_id')
    date_hierarchy = 'created_at'
    raw_id_fields = ('user',)

admin.site.register(UserInteraction, UserInteractionAdmin)
