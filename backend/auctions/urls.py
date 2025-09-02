from django.urls import path
from . import views

app_name = "auctions"

urlpatterns = [
    path("bulletins/<int:pk>/", views.bulletin_detail, name="bulletin_detail"),
    path("results/<int:result_id>/submit/", views.winner_submit, name="winner_submit"),
]
