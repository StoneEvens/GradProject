from django.urls import path
from .views import FeedOCRView
from .views import FirebaseImageUploadView

urlpatterns = [
    path('ocr/', FeedOCRView.as_view(), name='feed-ocr'),
    path('firebase/upload/', FirebaseImageUploadView.as_view(), name='firebase-upload'),
]