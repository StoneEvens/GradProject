from datetime import date, datetime, time
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth import get_user_model
from rest_framework.permissions import IsAuthenticated
from accounts.models import *
from accounts.serializers import *

User = get_user_model()

#登入
class LoginAPIView(APIView):
    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')

        try:
            user_obj = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'message': '查無此 email'}, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(request, username=user_obj.username, password=password)

        if user is not None and user.is_active:
            login(request, user)
            user_data = UserLoginSerializer(user).data
            return Response({
                'message': '登入成功',
                'user': user_data
            }, status=status.HTTP_200_OK)
        else:
            return Response({'message': '密碼錯誤'}, status=status.HTTP_401_UNAUTHORIZED)

#註冊
class RegisterAPIView(APIView):
    def post(self, request):
        user_account = request.data.get('user_account')
        password = request.data.get('password')
        email = request.data.get('email')
        user_fullname = request.data.get('user_fullname')

        if not user_account or not password or not email or not user_fullname:
            return Response({'message': '所有欄位皆為必填。'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(user_account=user_account).exists():
            return Response({'message': '帳號已存在。'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email=email).exists():
            return Response({'message': 'Email 已被使用。'}, status=status.HTTP_400_BAD_REQUEST)

        user = User(
            username=user_account,
            user_account=user_account,
            email=email,
            user_fullname=user_fullname
        )
        user.set_password(password)
        user.save()

        serializer = UserLoginSerializer(user)
        return Response({'message': '註冊成功！', 'user': serializer.data}, status=status.HTTP_201_CREATED)

#登出
class LogoutAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response({'message': '登出成功！'}, status=status.HTTP_200_OK)

#查詢個人資料
class MeAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        serializer = UserProfileSerializer(user)
        return Response({'user': serializer.data}, status=status.HTTP_200_OK)

#取今日行程
class TodayPlanAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = datetime.today().date()
        start_of_day = datetime.combine(today, time.min)  
        end_of_day = datetime.combine(today, time.max)    
        
        plans = Plan.objects.filter(user=request.user, date__range=(start_of_day, end_of_day))
        serializer = PlanSerializer(plans, many=True)
        return Response(serializer.data)

#取今日任務
class TodayMissionAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        missions = UserMission.objects.filter(user=request.user, due=today)
        serializer = UserMissionSerializer(missions, many=True)
        return Response(serializer.data)

#建立每日行程
class CreatePlanAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PlanSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)  
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

#取用戶頭像
class UserImageAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            user_image_url = request.user.headshot.img_url
        except:
            user_image_url = None
        return Response({'user_image_url': user_image_url})

#回傳使用者基本資料＋追蹤數、被追蹤數、發文（Post+Archive）數）
class UserSummaryView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, pk):
        user = get_object_or_404(CustomUser, pk=pk)
        followers = user.followers.count()      
        following = user.following.count()    
        post_count = user.posts.count()         
        archive_count = user.illness_archives.count()  
        total = post_count + archive_count

        data = {
            'id': user.id,
            'username': user.username,
            'user_fullname': user.user_fullname,
            'user_intro': user.user_intro,
            'followers_count': followers,
            'following_count': following,
            'posts_count': total,
        }
        serializer = UserSummarySerializer(data)
        return Response(serializer.data, status=status.HTTP_200_OK)
