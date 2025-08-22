from django.contrib import admin
from .models import Bulletin, AuctionSession, AuctionResult, Bid, Wallet


@admin.register(AuctionResult)
class AuctionResultAdmin(admin.ModelAdmin):
    list_display = ["session", "winning_user", "winning_amount", "pet_name", "content_status"]
    actions = ["approve_content"]

    def approve_content(self, request, queryset):
        for obj in queryset:
            obj.mark_published()
        self.message_user(request, "Selected results approved.")

    approve_content.short_description = "Approve selected contents"


admin.site.register(Bulletin)
admin.site.register(AuctionSession)
admin.site.register(Bid)
admin.site.register(Wallet)
