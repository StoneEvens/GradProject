"""
URL configuration for gradProject project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import include, path, re_path
from django.conf import settings
from django.conf.urls.static import static
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
# from calculator.views import FeedListByUser, FeedCreateView, PetNutritionCalculator, PetListByUser, PetCreateView, PetUpdateView  # 已忽略 calculator app

# 創建 Swagger 文檔視圖
schema_view = get_schema_view(
   openapi.Info(
      title="寵物 APP API",
      default_version='v1',
      description="寵物 APP API 文檔",
      terms_of_service="https://www.example.com/terms/",
      contact=openapi.Contact(email="contact@example.com"),
      license=openapi.License(name="BSD License"),
   ),
   public=True,
   permission_classes=[permissions.AllowAny],
)

# API 路由版本前綴
api_v1_prefix = 'api/v1/'

urlpatterns = [
    # Django Admin
    path('admin/', admin.site.urls),
    
    # API 版本化路由
    path(f'{api_v1_prefix}accounts/', include('accounts.urls')),
    path(f'{api_v1_prefix}pets/', include('pets.urls')),
    path(f'{api_v1_prefix}social/', include('social.urls')),
    path(f'{api_v1_prefix}feeds/', include('feeds.urls')),
    path(f'{api_v1_prefix}interactions/', include('interactions.urls')),
    path(f'{api_v1_prefix}comments/', include('comments.urls')),
    path(f'{api_v1_prefix}media/', include('media.urls')),
    path(f'{api_v1_prefix}article_recommendations/', include('articleRecommendation.urls')),

    # Swagger 文檔
    re_path(r'^swagger(?P<format>\.json|\.yaml)$', schema_view.without_ui(cache_timeout=0), name='schema-json'),
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
    
    # 以下為已忽略的 calculator app 相關路由
    # path('api/feeds/', FeedListByUser.as_view(), name='feed-list'),
    # path('calculator/', PetNutritionCalculator.as_view(), name = 'calculator'),
    # path("api/pets/", PetListByUser.as_view(), name="pet-list-by-user"),
    # path('api/pets/create/', PetCreateView.as_view(), name='pet-create'),  # 使用 pets app 的 API 代替
    # path("api/pets/update/", PetUpdateView.as_view(), name="pet-update"),
    # path("api/feeds/create/", FeedCreateView.as_view(), name="feed-create"),
    # path("api/feeds/", FeedListByUser.as_view(), name="feed-list-by-user"),
]

# 在開發環境中提供靜態檔案服務
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
