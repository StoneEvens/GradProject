from django.urls import path
from .views import index, upload

urlpatterns = [
    path('', index, name='ocrtest_index'),
    path('upload/', upload, name='upload')
]