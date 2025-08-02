from django.contrib import admin
from .models import Comment

class CommentAdmin(admin.ModelAdmin):
    list_display = ('user', 'created_at', 'popularity', 'parent', 'content', 'postFrame')
    list_filter = ('created_at',)
    search_fields = ('content', 'user__username')
    readonly_fields = ('created_at', 'popularity')
    raw_id_fields = ('user', 'parent')
    date_hierarchy = 'created_at'

admin.site.register(Comment, CommentAdmin)
