from django.urls import path
from . import views
from .views import PlaceBidView, SessionBidsView, CurrentHighestBidView, SettleAuctionView

app_name = "auctions"

urlpatterns = [
    path("bulletins/<int:pk>/", views.bulletin_detail, name="bulletin_detail"),
    path("results/<int:result_id>/submit/", views.winner_submit, name="winner_submit"),
    path("sessions/<int:session_id>/bid/", PlaceBidView.as_view(), name="place-bid"),
    path("sessions/<int:session_id>/bids/", SessionBidsView.as_view(), name="session-bids"),
    path("sessions/<int:session_id>/highest_bid/", CurrentHighestBidView.as_view(), name="highest-bid"),
    path("sessions/<int:session_id>/settle/", SettleAuctionView.as_view(), name="settle_auction"),
]
