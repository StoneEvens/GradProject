from django.contrib import admin
from .models import Feed, UserFeed, UserFeedRating, FeedReview, FeedErrorReport, UserFeedMark

# ;� Feed !�
@admin.register(Feed)
class FeedAdmin(admin.ModelAdmin):
    list_display = ['name', 'brand', 'pet_type', 'protein', 'fat', 'carbohydrate', 'price', 'review_count', 'is_verified', 'created_at']
    list_filter = ['pet_type', 'brand', 'is_verified', 'created_at']
    search_fields = ['name', 'brand']
    ordering = ['-created_at']

# ;� UserFeed !�
@admin.register(UserFeed)
class UserFeedAdmin(admin.ModelAdmin):
    list_display = ['user', 'pet', 'feed', 'usage_count', 'last_used_at']
    list_filter = ['last_used_at', 'pet__pet_type']
    search_fields = ['user__username', 'pet__pet_name', 'feed__name', 'feed__brand']
    ordering = ['-last_used_at']

# ;� UserFeedRating !�
@admin.register(UserFeedRating)
class UserFeedRatingAdmin(admin.ModelAdmin):
    list_display = ['user', 'pet', 'feed', 'rating', 'created_at']
    list_filter = ['rating', 'created_at']
    search_fields = ['user__username', 'pet__pet_name', 'feed__name', 'feed__brand', 'content']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at']

# 註冊 FeedReview 模型
@admin.register(FeedReview)
class FeedReviewAdmin(admin.ModelAdmin):
    list_display = ['feed', 'reviewer', 'reviewed_at']
    list_filter = ['reviewed_at']
    search_fields = ['feed__name', 'feed__brand', 'reviewer__username']
    ordering = ['-reviewed_at']
    readonly_fields = ['reviewed_at']

# 註冊 FeedErrorReport 模型
@admin.register(FeedErrorReport)
class FeedErrorReportAdmin(admin.ModelAdmin):
    list_display = ['feed', 'reporter', 'error_type', 'is_resolved', 'reported_at']
    list_filter = ['error_type', 'is_resolved', 'reported_at']
    search_fields = ['feed__name', 'feed__brand', 'reporter__username', 'description']
    ordering = ['-reported_at']
    readonly_fields = ['reported_at', 'resolved_at']
    list_editable = ['is_resolved']
    
    def save_model(self, request, obj, form, change):
        if change and 'is_resolved' in form.changed_data:
            if obj.is_resolved and not obj.resolved_at:
                from django.utils import timezone
                obj.resolved_at = timezone.now()
        super().save_model(request, obj, form, change)

# 註冊 UserFeedMark 模型
@admin.register(UserFeedMark)
class UserFeedMarkAdmin(admin.ModelAdmin):
    list_display = ['user', 'feed', 'created_at']
    list_filter = ['created_at']
    search_fields = ['user__username', 'feed__name', 'feed__brand']
    ordering = ['-created_at']
    readonly_fields = ['created_at']