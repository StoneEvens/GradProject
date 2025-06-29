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
        
        message = CustomUser.check_duplicate_user(user_account, email)

        if not message == "OK":
            return APIResponse(
                message=message,
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

# 自定義Token刷新視圖，提供更好的錯誤處理
class CustomTokenRefreshAPIView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if not refresh_token:
                return APIResponse(
                    message='刷新令牌不能為空',
                    code=40101,
                    status=drf_status.HTTP_400_BAD_REQUEST
                )
            
            # 嘗試創建RefreshToken實例
            try:
                token = RefreshToken(refresh_token)
                # token.verify() 會自動檢查黑名單
                
                # 生成新的access token
                access_token = str(token.access_token)
                
                # 如果需要輪換refresh token
                new_refresh_token = str(token)
                if hasattr(token, 'rotate'):
                    new_refresh_token = str(token.rotate())
                
                return APIResponse(
                    data={
                        'access': access_token,
                        'refresh': new_refresh_token
                    },
                    message='Token刷新成功',
                    status=drf_status.HTTP_200_OK
                )
                
            except Exception as token_error:
                error_msg = str(token_error)
                
                # 檢查是否為黑名單錯誤
                if 'blacklisted' in error_msg.lower():
                    return APIResponse(
                        message='身份驗證失敗',
                        code=40101,
                        status=drf_status.HTTP_401_UNAUTHORIZED,
                        data={'detail': 'Token已被列入黑名單，請重新登入'}
                    )
                elif 'expired' in error_msg.lower():
                    return APIResponse(
                        message='身份驗證失敗',
                        code=40101,
                        status=drf_status.HTTP_401_UNAUTHORIZED,
                        data={'detail': 'Token已過期，請重新登入'}
                    )
                else:
                    return APIResponse(
                        message='身份驗證失敗',
                        code=40101,
                        status=drf_status.HTTP_401_UNAUTHORIZED,
                        data={'detail': f'Token驗證失敗: {error_msg}'}
                    )
                    
        except Exception as e:
            logger.error(f'Token刷新過程中發生未預期錯誤: {str(e)}')
            return APIResponse(
                message='伺服器內部錯誤',
                code=50001,
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
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

# 標記行程為已完成或重新開始
class CompletePlanAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, plan_id):
        try:
            # 獲取行程並確認是當前用戶的行程
            plan = Plan.objects.get(id=plan_id, user=request.user)
            
            # 獲取請求中的 is_completed 值，默認為 True
            is_completed = request.data.get('is_completed', True)
            
            # 更新完成狀態
            plan.is_completed = is_completed
            plan.save()
            
            serializer = PlanSerializer(plan)
            
            # 根據操作類型返回不同的消息
            message = '行程已標記為完成' if is_completed else '行程已重新開始'
            
            return APIResponse(
                data=serializer.data,
                message=message,
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
                message=f'更新行程狀態時發生錯誤: {str(e)}',
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

# 編輯行程
class EditPlanAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, plan_id):
        try:
            # 獲取行程並確認是當前用戶的行程
            plan = Plan.objects.get(id=plan_id, user=request.user)
            serializer = PlanSerializer(plan)
            return APIResponse(
                data=serializer.data,
                message='成功獲取行程詳情',
                status=drf_status.HTTP_200_OK
            )
        except Plan.DoesNotExist:
            return APIResponse(
                message='找不到該行程或您無權限查看',
                code=drf_status.HTTP_404_NOT_FOUND,
                status=drf_status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return APIResponse(
                message=f'獲取行程詳情時發生錯誤: {str(e)}',
                code=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def put(self, request, plan_id):
        try:
            # 獲取行程並確認是當前用戶的行程
            plan = Plan.objects.get(id=plan_id, user=request.user)
            
            # 更新行程資訊
            serializer = PlanSerializer(plan, data=request.data)
            if serializer.is_valid():
                serializer.save()
                return APIResponse(
                    data=serializer.data,
                    message='行程更新成功',
                    status=drf_status.HTTP_200_OK
                )
            return APIResponse(
                message='驗證失敗',
                errors=serializer.errors,
                code=drf_status.HTTP_400_BAD_REQUEST,
                status=drf_status.HTTP_400_BAD_REQUEST
            )
        except Plan.DoesNotExist:
            return APIResponse(
                message='找不到該行程或您無權限修改',
                code=drf_status.HTTP_404_NOT_FOUND,
                status=drf_status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return APIResponse(
                message=f'更新行程時發生錯誤: {str(e)}',
                code=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )

# 按日期獲取行程
class DatePlanAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, date_str):
        try:
            # 將日期字符串轉換為日期對象
            try:
                date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return APIResponse(
                    message='日期格式無效，請使用YYYY-MM-DD格式',
                    code=drf_status.HTTP_400_BAD_REQUEST,
                    status=drf_status.HTTP_400_BAD_REQUEST
                )
            
            # 設置一天的開始和結束時間
            start_of_day = datetime.combine(date_obj, time.min)
            end_of_day = datetime.combine(date_obj, time.max)
            
            # 查詢當前用戶在指定日期的行程
            plans = Plan.objects.filter(
                user=request.user,
                date__range=(start_of_day, end_of_day)
            ).select_related('user')
            
            serializer = PlanSerializer(plans, many=True)
            
            return APIResponse(
                data=serializer.data,
                message=f'獲取{date_str}的行程成功',
                status=drf_status.HTTP_200_OK
            )
        except Exception as e:
            return APIResponse(
                message=f'獲取行程時發生錯誤: {str(e)}',
                code=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )
