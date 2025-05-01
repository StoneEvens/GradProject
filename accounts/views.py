from datetime import date, datetime, time
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model
from rest_framework.permissions import IsAuthenticated, AllowAny
from accounts.models import *
from accounts.serializers import *
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView as BaseTokenObtainPairView
from utils.api_response import APIResponse
from django.db.models import Count

User = get_user_model()

# 自定義 TokenObtainPairView 使用自定義的序列化器
class TokenObtainPairView(BaseTokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]  # 確保這個視圖可以被未認證的用戶訪問

# 註冊
class RegisterAPIView(APIView):
    permission_classes = [AllowAny]  # 註冊不需要認證
    
    def post(self, request):
        user_account = request.data.get('user_account')
        password = request.data.get('password')
        email = request.data.get('email')
        user_fullname = request.data.get('user_fullname')

        if not user_account or not password or not email or not user_fullname:
            return APIResponse(
                message='所有欄位皆為必填。',
                code=status.HTTP_400_BAD_REQUEST,
                status=status.HTTP_400_BAD_REQUEST
            )

        if User.objects.filter(user_account=user_account).exists():
            return APIResponse(
                message='帳號已存在。',
                code=status.HTTP_400_BAD_REQUEST,
                status=status.HTTP_400_BAD_REQUEST
            )

        if User.objects.filter(email=email).exists():
            return APIResponse(
                message='Email 已被使用。',
                code=status.HTTP_400_BAD_REQUEST,
                status=status.HTTP_400_BAD_REQUEST
            )

        user = User(
            username=user_account,
            user_account=user_account,
            email=email,
            user_fullname=user_fullname
        )
        user.set_password(password)
        user.save()

        # 創建令牌
        refresh = RefreshToken.for_user(user)
        serializer = UserLoginSerializer(user)
        
        return APIResponse(
            data=serializer.data,
            message='註冊成功！',
            tokens={
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
            status=status.HTTP_201_CREATED
        )

# 登出
class LogoutAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if not refresh_token:
                return APIResponse(
                    message='刷新令牌不能為空',
                    code=status.HTTP_400_BAD_REQUEST,
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            token = RefreshToken(refresh_token)
            token.blacklist()
            return APIResponse(message='登出成功！')
        except Exception as e:
            return APIResponse(
                message=f'登出失敗: {str(e)}',
                code=status.HTTP_400_BAD_REQUEST,
                status=status.HTTP_400_BAD_REQUEST
            )

# 查詢個人資料
class MeAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        serializer = UserProfileSerializer(user)
        return APIResponse(data=serializer.data)

# 取今日行程
class TodayPlanAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = datetime.today().date()
        start_of_day = datetime.combine(today, time.min)  
        end_of_day = datetime.combine(today, time.max)    
        
        # 使用 select_related 預加載相關模型
        plans = Plan.objects.filter(
            user=request.user, 
            date__range=(start_of_day, end_of_day)
        ).select_related('user')
        
        serializer = PlanSerializer(plans, many=True)
        return APIResponse(data=serializer.data)

# 取今日任務
class TodayMissionAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        
        # 使用 select_related 預加載相關模型
        missions = UserMission.objects.filter(
            user=request.user, 
            due=today
        ).select_related('mission', 'user')
        
        serializer = UserMissionSerializer(missions, many=True)
        return APIResponse(data=serializer.data)

# 建立每日行程
class CreatePlanAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PlanSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)  
            return APIResponse(
                data=serializer.data,
                message='行程創建成功',
                status=status.HTTP_201_CREATED
            )
        return APIResponse(
            message='驗證失敗',
            errors=serializer.errors,
            code=status.HTTP_400_BAD_REQUEST,
            status=status.HTTP_400_BAD_REQUEST
        )

# 取用戶頭像
class UserImageAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            user_image_url = request.user.headshot.img_url
        except AttributeError:
            user_image_url = None
        return APIResponse(data={'user_image_url': user_image_url})

# 回傳使用者基本資料＋追蹤數、被追蹤數、發文（Post+Archive）數）
class UserSummaryView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk):
        # 使用單一查詢並包含聚合函數，減少數據庫請求次數
        user = CustomUser.objects.annotate(
            followers_count=Count('followers', distinct=True),
            following_count=Count('following', distinct=True),
            posts_count=Count('posts', distinct=True),
            archives_count=Count('illness_archives', distinct=True)
        ).get(pk=pk)
        
        data = {
            'id': user.id,
            'username': user.username,
            'user_fullname': user.user_fullname,
            'user_intro': user.user_intro,
            'followers_count': user.followers_count,
            'following_count': user.following_count,
            'posts_count': user.posts_count + user.archives_count,
        }
        
        serializer = UserSummarySerializer(data)
        return APIResponse(data=serializer.data)
