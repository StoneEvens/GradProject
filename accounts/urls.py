from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView
from .views import *
from .api import RecordUserActionAPIView, CheckMissionConditionsAPIView

urlpatterns = [
    path('token/', TokenObtainPairView.as_view(), name='token-obtain-pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('token/verify/', TokenVerifyView.as_view(), name='token-verify'),
    path('register/', RegisterAPIView.as_view(), name='accounts-register'),
    path('logout/', LogoutAPIView.as_view(), name='accounts-logout'),
    path('me/', MeAPIView.as_view(), name='accounts-me'),
    path('plans/today/', TodayPlanAPIView.as_view(), name='today-plans'),
    path('missions/today/', TodayMissionAPIView.as_view(), name='today-missions'),
    path('profile/image/', UserImageAPIView.as_view(), name='user-image'),
    path('plans/create/', CreatePlanAPIView.as_view(), name='create-plan'),
    path('user/<int:pk>/summary/', UserSummaryView.as_view(), name='user-summary'),
    
    # 任務相關的API
    path('missions/active/', UserActiveMissionsAPIView.as_view(), name='active-missions'),
    path('missions/completed/', UserCompletedMissionsAPIView.as_view(), name='completed-missions'),
    path('missions/<int:mission_id>/complete/', CompleteMissionAPIView.as_view(), name='complete-mission'),
    
    # 任務條件相關API
    path('user-action/record/', RecordUserActionAPIView.as_view(), name='record-user-action'),
    path('missions/<int:mission_id>/conditions/', CheckMissionConditionsAPIView.as_view(), name='check-mission-conditions'),
]
