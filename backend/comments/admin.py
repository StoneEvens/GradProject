from django.contrib import admin
from .models import Comment

class CommentAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'content_type', 'object_id', 'post_date', 'popularity', 'parent', 'depth')
    list_filter = ('content_type', 'post_date', 'depth')
    search_fields = ('content', 'user__username')
    readonly_fields = ('post_date', 'popularity')
    raw_id_fields = ('user', 'parent', 'mentioned_user')
    date_hierarchy = 'post_date'

admin.site.register(Comment, CommentAdmin)
