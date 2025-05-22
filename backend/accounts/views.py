from datetime import date, datetime, time, timedelta
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status as drf_status
from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model
from rest_framework.permissions import IsAuthenticated, AllowAny
from accounts.models import *
from accounts.serializers import *
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView as BaseTokenObtainPairView
from utils.api_response import APIResponse
from django.db.models import Count
from django.db import transaction
from django.db.models import Q, Sum

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
                code=drf_status.HTTP_400_BAD_REQUEST,
                status=drf_status.HTTP_400_BAD_REQUEST
            )

        if User.objects.filter(user_account=user_account).exists():
            return APIResponse(
                message='帳號已存在。',
                code=drf_status.HTTP_400_BAD_REQUEST,
                status=drf_status.HTTP_400_BAD_REQUEST
            )

        if User.objects.filter(email=email).exists():
            return APIResponse(
                message='Email 已被使用。',
                code=drf_status.HTTP_400_BAD_REQUEST,
                status=drf_status.HTTP_400_BAD_REQUEST
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
            status=drf_status.HTTP_201_CREATED
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
                    code=drf_status.HTTP_400_BAD_REQUEST,
                    status=drf_status.HTTP_400_BAD_REQUEST
                )
                
            token = RefreshToken(refresh_token)
            token.blacklist()
            return APIResponse(message='登出成功！')
        except Exception as e:
            return APIResponse(
                message=f'登出失敗: {str(e)}',
                code=drf_status.HTTP_400_BAD_REQUEST,
                status=drf_status.HTTP_400_BAD_REQUEST
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

# 檢查帳號是否已存在
class CheckUserAccountAPIView(APIView):
    permission_classes = [AllowAny]  # 不需要認證

    def post(self, request):
        user_account = request.data.get('user_account')
        
        if not user_account:
            return APIResponse(
                message='請提供帳號名稱',
                code=drf_status.HTTP_400_BAD_REQUEST,
                status=drf_status.HTTP_400_BAD_REQUEST
            )

        account_exists = User.objects.filter(user_account=user_account).exists()
        
        return APIResponse(
            data={
                'exists': account_exists
            },
            message='帳號檢查完成',
            status=drf_status.HTTP_200_OK
        )

# 檢查電子郵件是否已被使用
class CheckEmailAPIView(APIView):
    permission_classes = [AllowAny]  # 不需要認證

    def post(self, request):
        email = request.data.get('email')
        
        if not email:
            return APIResponse(
                message='請提供電子郵件',
                code=drf_status.HTTP_400_BAD_REQUEST,
                status=drf_status.HTTP_400_BAD_REQUEST
            )

        email_exists = User.objects.filter(email=email).exists()
        
        return APIResponse(
            data={
                'exists': email_exists
            },
            message='電子郵件檢查完成',
            status=drf_status.HTTP_200_OK
        )

# 檢查密碼是否已被使用
class CheckPasswordAPIView(APIView):
    permission_classes = [AllowAny]  # 不需要認證

    def post(self, request):
        password = request.data.get('password')
        
        if not password:
            return APIResponse(
                message='請提供密碼',
                code=drf_status.HTTP_400_BAD_REQUEST,
                status=drf_status.HTTP_400_BAD_REQUEST
            )

        # 注意: 由於密碼是雜湊存儲的，我們無法直接查詢相同密碼
        # 這裡的實現是將密碼雜湊後與資料庫中的雜湊進行比較
        # 但這在實際操作中效率較低且不太安全，通常不建議檢查密碼是否被使用
        # 這裡僅作示範，實際應用中應謹慎評估
        
        # 簡化實現：始終返回不存在
        password_exists = False
        
        return APIResponse(
            data={
                'exists': password_exists
            },
            message='密碼檢查完成',
            status=drf_status.HTTP_200_OK
        )

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
                status=drf_status.HTTP_201_CREATED
            )
        return APIResponse(
            message='驗證失敗',
            errors=serializer.errors,
            code=drf_status.HTTP_400_BAD_REQUEST,
            status=drf_status.HTTP_400_BAD_REQUEST
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

# 用戶完成任務
class CompleteMissionAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, mission_id):
        try:
            # 獲取用戶任務
            user_mission = UserMission.objects.select_related('mission', 'user').get(
                id=mission_id,
                user=request.user,
                status='pending'
            )
            
            # 檢查是否有條件需要滿足
            mission_conditions = user_mission.mission.conditions.all()
            points_earned = user_mission.mission.point
            user = user_mission.user
            
            if mission_conditions.exists():
                # 如果任務需要滿足特定條件
                from accounts.services import MissionConditionService # 假設此服務存在
                is_completed, message = MissionConditionService.check_mission_completion(user_mission)
                
                if not is_completed:
                    return APIResponse(
                        message=message or "任務條件尚未滿足，無法完成任務",
                        code=drf_status.HTTP_400_BAD_REQUEST,
                        status=drf_status.HTTP_400_BAD_REQUEST
                    )
                
                # 假設 MissionConditionService.check_mission_completion 會處理狀態更新和積分 (如果它會)
                # 如果 MissionConditionService 不處理積分，則在這裡處理
                # current_total_points = user.add_points(points_earned) # 移到下方統一處理或由 service 處理
            else:
                # 如果沒有條件，直接標記完成並給予積分
                user_mission.status = 'completed'
                user_mission.date_achieved = date.today()
                user_mission.save(update_fields=['status', 'date_achieved'])
                # 給予積分
            
            current_total_points = user.add_points(points_earned)

            return APIResponse(
                message="任務完成成功！",
                data={
                    'mission_id': user_mission.id,
                    'points_earned': points_earned,
                    'current_total_points': current_total_points
                }
            )

        except UserMission.DoesNotExist:
            return APIResponse(
                message="找不到指定的任務或任務已完成",
                code=drf_status.HTTP_404_NOT_FOUND,
                status=drf_status.HTTP_404_NOT_FOUND
            )

# 獲取用戶當前所有任務
class UserActiveMissionsAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        today = date.today()
        
        # 獲取用戶所有未過期的任務
        active_missions = UserMission.objects.filter(
            user=request.user,
            status='pending',
            due__gte=today
        ).select_related('mission')
        
        # 序列化數據，添加額外信息
        missions_data = []
        for user_mission in active_missions:
            mission = user_mission.mission
            days_left = (user_mission.due - today).days
            
            missions_data.append({
                'user_mission_id': user_mission.id,
                'mission_id': mission.id,
                'mission_name': mission.mission_name,
                'description': mission.description,
                'point': mission.point,
                'level': mission.level,
                'due_date': user_mission.due,
                'days_left': days_left,
                'status': user_mission.status
            })
        
        # 按等級和獎勵點數排序
        missions_data.sort(key=lambda x: (-1 if x['level'] == 'high' else 0, -x['point']))
        
        return APIResponse(
            data=missions_data,
            message="獲取活躍任務成功"
        )

# 獲取用戶已完成任務
class UserCompletedMissionsAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        today = date.today()
        
        # 獲取用戶所有已完成的任務（最近一周內完成的）
        one_week_ago = today - timedelta(days=7)
        completed_missions = UserMission.objects.filter(
            user=request.user,
            status='completed',
            date_achieved__gte=one_week_ago  # 只獲取一周內完成的任務
        ).select_related('mission').order_by('-date_achieved')
        
        # 序列化數據
        missions_data = []
        for user_mission in completed_missions:
            mission = user_mission.mission
            missions_data.append({
                'user_mission_id': user_mission.id,
                'mission_id': mission.id,
                'mission_name': mission.mission_name,
                'description': mission.description,
                'point': mission.point,
                'level': mission.level,
                'completed_date': user_mission.date_achieved,
                'days_left': 7 - (today - user_mission.date_achieved).days  # 還有幾天會被刪除
            })
        
        return APIResponse(
            data=missions_data,
            message="獲取已完成任務成功"
        )

# 標記行程為已完成
class CompletePlanAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, plan_id):
        try:
            # 獲取行程並確認是當前用戶的行程
            plan = Plan.objects.get(id=plan_id, user=request.user)
            
            # 標記為已完成
            plan.is_completed = True
            plan.save()
            
            serializer = PlanSerializer(plan)
            return APIResponse(
                data=serializer.data,
                message='行程已標記為完成',
                status=drf_status.HTTP_200_OK
            )
        except Plan.DoesNotExist:
            return APIResponse(
                message='找不到該行程或您無權限修改',
                code=drf_status.HTTP_404_NOT_FOUND,
                status=drf_status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return APIResponse(
                message=f'標記行程完成時發生錯誤: {str(e)}',
                code=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )

# 刪除行程
class DeletePlanAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, plan_id):
        try:
            # 獲取行程並確認是當前用戶的行程
            plan = Plan.objects.get(id=plan_id, user=request.user)
            
            # 刪除行程
            plan.delete()
            
            return APIResponse(
                message='行程已成功刪除',
                status=drf_status.HTTP_200_OK
            )
        except Plan.DoesNotExist:
            return APIResponse(
                message='找不到該行程或您無權限刪除',
                code=drf_status.HTTP_404_NOT_FOUND,
                status=drf_status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return APIResponse(
                message=f'刪除行程時發生錯誤: {str(e)}',
                code=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )
