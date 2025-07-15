# feeds/urls.py
from django.urls import path
from . import views  # 確保這行存在

urlpatterns = [
    # 這裡可以先暫時放個假路由做測試
    path('test/', views.test_view, name='test'),
]
