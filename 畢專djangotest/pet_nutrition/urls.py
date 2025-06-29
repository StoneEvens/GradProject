from django.urls import path, include
from django.contrib import admin
from ocrapp.views import OCRUploadView
from calculator.views import PetNutritionCalculator, PetListByUser
from abnormal_record_upload.views import SymptomRecordViewSet, generate_summary

# Swagger
from rest_framework import permissions, routers
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from django.conf import settings
from django.conf.urls.static import static

router = routers.DefaultRouter()
router.register(r'symptom-records', SymptomRecordViewSet)

schema_view = get_schema_view(
    openapi.Info(title="健康報告 OCR API", default_version='v1'),
    public=True,
    permission_classes=(permissions.AllowAny,),
)

urlpatterns = [
    # path('api/ocr/', OCRUploadView.as_view()),
    path('admin/', admin.site.urls),
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0)),
    path('ocr/', OCRUploadView.as_view(), name='ocr-upload'),
    path('calculator/', PetNutritionCalculator.as_view(), name = 'calculator'),
    path('api/', include(router.urls)),
    path('api/generate-summary/', generate_summary),
    path("api/pets/", PetListByUser.as_view(), name="pet-list-by-user"),
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)


