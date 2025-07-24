from django.contrib import admin
from .models import Comment

class CommentAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'post_date', 'popularity', 'parent')
    list_filter = ('post_date',)
    search_fields = ('content', 'user__username')
    readonly_fields = ('post_date', 'popularity')
    raw_id_fields = ('user', 'parent')
    date_hierarchy = 'post_date'

admin.site.register(Comment, CommentAdmin)
