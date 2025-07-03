from django.contrib import admin
from .models import UserInteraction

class UserInteractionAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'relation', 'created_at')
    list_filter = ('relation', 'created_at')
    date_hierarchy = 'created_at'
    raw_id_fields = ('user',)

admin.site.register(UserInteraction, UserInteractionAdmin)
