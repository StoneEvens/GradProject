from django.contrib import admin
from django.urls import path
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from calculator.views import PetNutritionCalculator

schema_view = get_schema_view(
    openapi.Info(
        title="Pet Nutrition Calculator API",
        default_version='v1',
        description="API for calculating pet daily nutrition with OpenAI GPT-4 suggestions.",
        terms_of_service="https://www.google.com/policies/terms/",
        contact=openapi.Contact(email="your_email@example.com"),
        license=openapi.License(name="BSD License"),
    ),
    public=True,
    permission_classes=(permissions.AllowAny,),
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/calculate/', PetNutritionCalculator.as_view(), name='calculate'),
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
]
