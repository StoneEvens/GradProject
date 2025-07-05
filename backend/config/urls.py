from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

# Swagger 文檔配置
schema_view = get_schema_view(
    openapi.Info(
        title="寵物飼料計算 API",
        default_version='v1',
        description="提供寵物飼料上傳、營養計算和飼料管理功能的 API",
        terms_of_service="https://www.google.com/policies/terms/",
        contact=openapi.Contact(email="contact@example.com"),
        license=openapi.License(name="MIT License"),
    ),
    public=True,
    permission_classes=(permissions.AllowAny,),
)

# API 版本控制
api_version_patterns = [
    # 各應用的 API 路由
    path('feeds/', include('feeds.urls')),
    path('pets/', include('pets.urls')),
    path('accounts/', include('accounts.urls')),
    # 添加其他應用的 API 路由...
]

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # API 版本前綴
    path('api/v1/', include(api_version_patterns)),
    
    # API 文檔
    re_path(r'^swagger(?P<format>\.json|\.yaml)$', schema_view.without_ui(cache_timeout=0), name='schema-json'),
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
    
    # 兼容舊版 API 路由（臨時）
    path('', include('feeds.urls')),
    path('', include('pets.urls')),
    path('', include('accounts.urls')),
]

# 開發環境下的靜態文件和媒體文件路由（媒體文件主要使用 Firebase Storage）
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT) 