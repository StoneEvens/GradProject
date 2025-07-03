from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView
from .views import *

urlpatterns = [
    path('token/', TokenObtainPairView.as_view(), name='token-obtain-pair'),
    path('token/refresh/', CustomTokenRefreshAPIView.as_view(), name='token-refresh'),
    path('token/verify/', TokenVerifyView.as_view(), name='token-verify'),
    path('register/', RegisterAPIView.as_view(), name='accounts-register'),
    path('logout/', LogoutAPIView.as_view(), name='accounts-logout'),
    path('me/', MeAPIView.as_view(), name='accounts-me'),
    path('plans/today/', TodayPlanAPIView.as_view(), name='today-plans'),
    path('plans/date/<str:date_str>/', DatePlanAPIView.as_view(), name='date-plans'),
    path('profile/image/', UserImageAPIView.as_view(), name='user-image'),
    path('plans/create/', CreatePlanAPIView.as_view(), name='create-plan'),
    path('plans/<int:plan_id>/complete/', CompletePlanAPIView.as_view(), name='complete-plan'),
    path('plans/<int:plan_id>/', DeletePlanAPIView.as_view(), name='delete-plan'),
    path('plans/<int:plan_id>/edit/', EditPlanAPIView.as_view(), name='edit-plan'),
    path('user/<int:pk>/profile/', UserProfileView.as_view(), name='user-profile'),
    path('user/<str:user_account>/profile/', UserProfileByAccountView.as_view(), name='user-profile-by-account'),
    path('user/<int:pk>/summary/', UserSummaryView.as_view(), name='user-summary'),
    path('user/<str:user_account>/summary/', UserSummaryByAccountView.as_view(), name='user-summary-by-account'),
    
    # 註冊驗證 API
    path('check/account/', CheckUserAccountAPIView.as_view(), name='check-account'),
    path('check/email/', CheckEmailAPIView.as_view(), name='check-email'),
    path('check/password/', CheckPasswordAPIView.as_view(), name='check-password'),

    
    # 追蹤相關 API
    path('follow/<int:user_id>/', FollowAPIView.as_view(), name='follow-user'),
    path('follow/<str:user_account>/', FollowByAccountAPIView.as_view(), name='follow-user-by-account'),
    path('follow/status/batch/', FollowStatusBatchAPIView.as_view(), name='follow-status-batch'),
    path('following/', FollowingListAPIView.as_view(), name='following-list'),
    path('followers/', FollowersListAPIView.as_view(), name='followers-list'),
    path('followers/remove/<str:user_account>/', RemoveFollowerAPIView.as_view(), name='remove-follower'),
    
    # 通知相關路由
    path('notifications/', NotificationListAPIView.as_view(), name='notification-list'),
    path('notifications/<int:notification_id>/read/', MarkNotificationAsReadAPIView.as_view(), name='mark-notification-read'),
    path('notifications/read-all/', MarkAllNotificationsAsReadAPIView.as_view(), name='mark-all-notifications-read'),
    path('notifications/<int:notification_id>/follow-request/', FollowRequestResponseAPIView.as_view(), name='follow-request-response'),
]
