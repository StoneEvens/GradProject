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
from utils.firebase_service import FirebaseStorageService

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
        user = CustomUser.get_user(username=request.user)
        serializer = UserProfileSerializer(user)
        return APIResponse(data=serializer.data)
    
    def put(self, request):
        print(request)
        print(request.data)
        print(request.user)

        user = CustomUser.get_user(username=request.user)
        found = True if user is not None else False
        print(found)

        if 'headshot' in request.FILES:
            firebase_service = FirebaseStorageService()
            
            try:
                # 上傳頭像到 Firebase Storage   
                headshot_file = request.FILES['headshot']
                success, message, download_url, file_path = firebase_service.upload_user_avatar(user.id, headshot_file)
                
                if not success:
                    return APIResponse(
                        message=message,
                        code=drf_status.HTTP_400_BAD_REQUEST,
                        status=drf_status.HTTP_400_BAD_REQUEST
                    )
                
                # 儲存頭像資料到資料庫
                headshot_image = UserHeadshot.get_headshot(user=user)
                
                if headshot_image is not None:
                    # 如果已存在頭像，先刪除舊的 Firebase Storage 檔案
                    from utils.firebase_service import cleanup_old_headshot
                    old_firebase_path = headshot_image.firebase_path
                    cleanup_old_headshot(old_firebase_path, logger)
                    
                    # 更新為新的URL和路徑
                    headshot_image.firebase_url = download_url
                    headshot_image.firebase_path = file_path
                    headshot_image.save()
                else:
                    UserHeadshot.create(user=user, firebase_path=file_path, firebase_url=download_url)
                
            except Exception as e:
                return APIResponse(
                    message=f'頭像上傳失敗: {str(e)}',
                    code=drf_status.HTTP_400_BAD_REQUEST,
                    status=drf_status.HTTP_400_BAD_REQUEST
                )

        serializer = UserProfileSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()

            with transaction.atomic():
                user = CustomUser.objects.select_related('headshot').get(id=user.id)
            updated_serializer = UserProfileSerializer(user)

            print(updated_serializer.data)

            return APIResponse(
                data=updated_serializer.data,
                message='個人資料更新成功',
                status=drf_status.HTTP_200_OK
            )
        
        return APIResponse(
            message='驗證失敗',
            errors=serializer.errors,
            code=drf_status.HTTP_400_BAD_REQUEST,
            status=drf_status.HTTP_400_BAD_REQUEST
        )

# 取今日行程
class TodayPlanAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        username = request.user
        user = CustomUser.get_user(username=username)

        today = datetime.today().date()
        start_of_day = datetime.combine(today, time.min)  
        end_of_day = datetime.combine(today, time.max)    
        
        # 使用 select_related 預加載相關模型
        plans = Plan.get_plan(user, start_of_day, end_of_day)
        
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

        account_exists = CustomUser.check_username(username=user_account)
        
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

        email_exists = CustomUser.check_email(email=email)
        
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
            followers_count=Count('followers', filter=models.Q(followers__confirm_or_not=True), distinct=True),
            following_count=Count('following', filter=models.Q(following__confirm_or_not=True), distinct=True),
            posts_count=Count('postframes', distinct=True),
            #archives_count=Count('illness_archives', distinct=True)
        ).get(pk=pk)
        
        data = {
            'id': user.id,
            'username': user.username,
            'user_fullname': user.user_fullname,
            'user_intro': user.user_intro,
            'followers_count': user.followers_count,
            'following_count': user.following_count,
            'posts_count': user.posts_count# + user.archives_count,
        }
        
        serializer = UserSummarySerializer(data)
        return APIResponse(data=serializer.data)

#----------Not Checked Yet----------#

# 獲取特定用戶的基本資料（通過ID）
class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk):
        try:
            # 獲取目標用戶的基本資料
            user = CustomUser.objects.select_related('headshot').get(pk=pk)
            serializer = UserProfileSerializer(user)
            return APIResponse(data=serializer.data, message='獲取用戶資料成功')
        except CustomUser.DoesNotExist:
            return APIResponse(
                message='找不到該使用者',
                code=drf_status.HTTP_404_NOT_FOUND,
                status=drf_status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return APIResponse(
                message=f'獲取用戶資料失敗: {str(e)}',
                code=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )

# 獲取特定用戶的基本資料（通過user_account）
class UserProfileByAccountView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, user_account):
        try:
            # 獲取目標用戶的基本資料
            user = CustomUser.objects.select_related('headshot').get(user_account=user_account)
            serializer = UserProfileSerializer(user)
            return APIResponse(data=serializer.data, message='獲取用戶資料成功')
        except CustomUser.DoesNotExist:
            return APIResponse(
                message='找不到該使用者',
                code=drf_status.HTTP_404_NOT_FOUND,
                status=drf_status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return APIResponse(
                message=f'獲取用戶資料失敗: {str(e)}',
                code=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
# 回傳使用者基本資料＋追蹤數、被追蹤數、發文（Post+Archive）數）- 通過user_account
class UserSummaryByAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_account):
        # 使用單一查詢並包含聚合函數，減少數據庫請求次數
        user = CustomUser.objects.annotate(
            followers_count=Count('followers', distinct=True),
            following_count=Count('following', distinct=True),
            posts_count=Count('postframes', distinct=True),
            #archives_count=Count('illness_archives', distinct=True)
        ).get(user_account=user_account)
        
        data = {
            'id': user.id,
            'username': user.username,
            'user_fullname': user.user_fullname,
            'user_intro': user.user_intro,
            'followers_count': user.followers_count,
            'following_count': user.following_count,
            'posts_count': user.posts_count# + user.archives_count,
        }
        
        serializer = UserSummarySerializer(data)
        return APIResponse(data=serializer.data)
        
#----------Not Checked Ended----------#

# 標記行程為已完成或重新開始
class CompletePlanAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, plan_id):
        try:
            username = request.user
            user = CustomUser.get_user(username=username)

            # 獲取行程並確認是當前用戶的行程
            plan = Plan.get_plan(user=user, id=plan_id)
            
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
            username = request.user
            user = CustomUser.get_user(username=username)

            plan = Plan.get_plan(user=user, id=plan_id)
            
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
            username = request.user
            user = CustomUser.ge_user(username=username)

            plan = Plan.get_plan(user=user, id=plan_id)
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
            username = request.user
            user = CustomUser.get_user(username=username)

            plan = Plan.get_plan(user=user, id=plan_id)
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
                date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return APIResponse(
                    message='日期格式無效，請使用YYYY-MM-DD格式',
                    code=drf_status.HTTP_400_BAD_REQUEST,
                    status=drf_status.HTTP_400_BAD_REQUEST
                )
            
            # 設置一天的開始和結束時間
            start_of_day = datetime.combine(date, time.min)
            end_of_day = datetime.combine(date, time.max)

            username = request.user
            user = CustomUser.get_user(username=username)
            
            # 查詢當前用戶在指定日期的行程
            plans = Plan.get_plan(user=user, start_time=start_of_day, end_time=end_of_day)
            
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

#----------Code Above Checked----------#

class FollowAlgorithms:

    def post(request, user_id=None, user_account=None):
        # 檢查要追蹤的使用者是否存在
        target_user = CustomUser.get_user(id=user_id)
        
        # 不能追蹤自己
        username = request.user
        user = CustomUser.get_user(username=username)

        if target_user == user:
            return APIResponse(
                message='不能追蹤自己',
                code=drf_status.HTTP_400_BAD_REQUEST,
                status=drf_status.HTTP_400_BAD_REQUEST
            )
        
        # 檢查是否已經有追蹤關係
        try:
            follow_relation = UserFollow.check_follow(user, target_user)
            # 已存在關係，取消追蹤
            # 如果是待確認的追蹤請求，刪除相關通知
            if not follow_relation.confirm_or_not:
                # 刪除相關的追蹤請求通知
                FollowNotification.objects.filter(
                    user=target_user,
                    notification_type='follow_request',
                    follow_request_from=request.user,
                    related_follow=follow_relation
                ).delete()
            
            follow_relation.delete()
            return APIResponse(
                data={
                    'is_following': False, 
                    'is_requested': False,
                    'message': f'已取消追蹤 {target_user.username}'
                },
                message='取消追蹤成功',
                status=drf_status.HTTP_200_OK
            )
        except UserFollow.DoesNotExist:
            # 沒有追蹤關係，建立新的
            if target_user.account_privacy == 'private':
                # private帳戶需要等待確認
                follow_relation = UserFollow.objects.create(
                    user=request.user,
                    follows=target_user,
                    confirm_or_not=False  # 等待確認
                )
                
                # 建立追蹤請求通知
                notification = FollowNotification.objects.create(
                    user=target_user,
                    notification_type='follow_request',
                    content=f'{request.user.username} 希望追蹤您',
                    follow_request_from=request.user,
                    related_follow=follow_relation
                )
                
                return APIResponse(
                    data={
                        'is_following': False,
                        'is_requested': True,
                        'message': f'已發送追蹤請求給 {target_user.username}'
                    },
                    message='追蹤請求已發送',
                    status=drf_status.HTTP_201_CREATED
                )
            else:
                # public帳戶直接確認
                follow_relation = UserFollow.objects.create(
                    user=request.user,
                    follows=target_user,
                    confirm_or_not=True  # 直接確認
                )
                return APIResponse(
                    data={
                        'is_following': True,
                        'is_requested': False,
                        'message': f'已開始追蹤 {target_user.username}'
                    },
                    message='追蹤成功',
                    status=drf_status.HTTP_201_CREATED
                )

# 追蹤相關API
class FollowAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, user_id):
        """追蹤或取消追蹤使用者"""
        try:
            # 檢查要追蹤的使用者是否存在
            target_user = CustomUser.get_user(id=user_id)
            
            # 不能追蹤自己
            username = request.user
            user = CustomUser.get_user(username=username)

            if target_user == user:
                return APIResponse(
                    message='不能追蹤自己',
                    code=drf_status.HTTP_400_BAD_REQUEST,
                    status=drf_status.HTTP_400_BAD_REQUEST
                )
            
            # 檢查是否已經有追蹤關係
            try:
                follow_relation = UserFollow.check_follow(user, target_user)
                # 已存在關係，取消追蹤
                # 如果是待確認的追蹤請求，刪除相關通知
                if not follow_relation.confirm_or_not:
                    # 刪除相關的追蹤請求通知
                    FollowNotification.objects.filter(
                        user=target_user,
                        notification_type='follow_request',
                        follow_request_from=request.user,
                        related_follow=follow_relation
                    ).delete()
                
                follow_relation.delete()
                return APIResponse(
                    data={
                        'is_following': False, 
                        'is_requested': False,
                        'message': f'已取消追蹤 {target_user.username}'
                    },
                    message='取消追蹤成功',
                    status=drf_status.HTTP_200_OK
                )
            except UserFollow.DoesNotExist:
                # 沒有追蹤關係，建立新的
                if target_user.account_privacy == 'private':
                    # private帳戶需要等待確認
                    follow_relation = UserFollow.objects.create(
                        user=request.user,
                        follows=target_user,
                        confirm_or_not=False  # 等待確認
                    )
                    
                    # 建立追蹤請求通知
                    notification = FollowNotification.objects.create(
                        user=target_user,
                        notification_type='follow_request',
                        content=f'{request.user.username} 希望追蹤您',
                        follow_request_from=request.user,
                        related_follow=follow_relation
                    )
                    
                    return APIResponse(
                        data={
                            'is_following': False,
                            'is_requested': True,
                            'message': f'已發送追蹤請求給 {target_user.username}'
                        },
                        message='追蹤請求已發送',
                        status=drf_status.HTTP_201_CREATED
                    )
                else:
                    # public帳戶直接確認
                    follow_relation = UserFollow.objects.create(
                        user=request.user,
                        follows=target_user,
                        confirm_or_not=True  # 直接確認
                    )
                    return APIResponse(
                        data={
                            'is_following': True,
                            'is_requested': False,
                            'message': f'已開始追蹤 {target_user.username}'
                        },
                        message='追蹤成功',
                        status=drf_status.HTTP_201_CREATED
                    )
                
        except CustomUser.DoesNotExist:
            return APIResponse(
                message='找不到該使用者',
                code=drf_status.HTTP_404_NOT_FOUND,
                status=drf_status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return APIResponse(
                message=f'追蹤操作失敗: {str(e)}',
                code=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def get(self, request, user_id):
        """獲取單個使用者的追蹤狀態"""
        try:
            target_user = CustomUser.objects.get(id=user_id)
            
            # 檢查追蹤關係
            try:
                follow_relation = UserFollow.objects.get(
                    user=request.user,
                    follows=target_user
                )
                # 有追蹤關係，檢查是否已確認
                is_following = follow_relation.confirm_or_not
                is_requested = not follow_relation.confirm_or_not
            except UserFollow.DoesNotExist:
                # 沒有追蹤關係
                is_following = False
                is_requested = False
            
            return APIResponse(
                data={
                    'is_following': is_following,
                    'is_requested': is_requested,
                    'account_privacy': target_user.account_privacy
                },
                message='獲取追蹤狀態成功',
                status=drf_status.HTTP_200_OK
            )
            
        except CustomUser.DoesNotExist:
            return APIResponse(
                message='找不到該使用者',
                code=drf_status.HTTP_404_NOT_FOUND,
                status=drf_status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return APIResponse(
                message=f'獲取追蹤狀態失敗: {str(e)}',
                code=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )

# 通過user_account進行追蹤操作
class FollowByAccountAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, user_account):
        """追蹤或取消追蹤使用者（通過user_account）"""
        try:
            # 檢查要追蹤的使用者是否存在
            target_user = CustomUser.objects.get(user_account=user_account)
            
            # 不能追蹤自己
            if target_user == request.user:
                return APIResponse(
                    message='不能追蹤自己',
                    code=drf_status.HTTP_400_BAD_REQUEST,
                    status=drf_status.HTTP_400_BAD_REQUEST
                )
            
            # 檢查是否已經有追蹤關係
            try:
                follow_relation = UserFollow.objects.get(
                    user=CustomUser.get_user(username=request.user),
                    follows=target_user
                )
                # 已存在關係，取消追蹤
                # 如果是待確認的追蹤請求，刪除相關通知
                if not follow_relation.confirm_or_not:
                    # 刪除相關的追蹤請求通知
                    FollowNotification.objects.filter(
                        user=target_user,
                        notification_type='follow_request',
                        follow_request_from=request.user,
                        related_follow=follow_relation
                    ).delete()
                
                follow_relation.delete()
                return APIResponse(
                    data={
                        'is_following': False, 
                        'is_requested': False,
                        'message': f'已取消追蹤 {target_user.username}'
                    },
                    message='取消追蹤成功',
                    status=drf_status.HTTP_200_OK
                )
            except UserFollow.DoesNotExist:
                # 沒有追蹤關係，建立新的
                print(target_user.account_privacy)

                if target_user.account_privacy == 'private':
                    # private帳戶需要等待確認
                    follow_relation = UserFollow.objects.create(
                        user=request.user,
                        follows=target_user,
                        confirm_or_not=False  # 等待確認
                    )
                    
                    # 建立追蹤請求通知
                    notification = FollowNotification.objects.create(
                        user=target_user,
                        content=f'{request.user.username} 希望追蹤您'
                    )
                    
                    return APIResponse(
                        data={
                            'is_following': False,
                            'is_requested': True,
                            'message': f'已發送追蹤請求給 {target_user.username}'
                        },
                        message='追蹤請求已發送',
                        status=drf_status.HTTP_201_CREATED
                    )
                else:
                    # public帳戶直接確認
                    follow_relation = UserFollow.objects.create(
                        user=request.user,
                        follows=target_user,
                        confirm_or_not=True  # 直接確認
                    )
                    return APIResponse(
                        data={
                            'is_following': True,
                            'is_requested': False,
                            'message': f'已開始追蹤 {target_user.username}'
                        },
                        message='追蹤成功',
                        status=drf_status.HTTP_201_CREATED
                    )
                
        except CustomUser.DoesNotExist:
            return APIResponse(
                message='找不到該使用者',
                code=drf_status.HTTP_404_NOT_FOUND,
                status=drf_status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return APIResponse(
                message=f'追蹤操作失敗: {str(e)}',
                code=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def get(self, request, user_account):
        """獲取使用者的追蹤狀態（通過user_account）"""
        try:
            target_user = CustomUser.objects.get(user_account=user_account)
            
            # 檢查追蹤關係
            try:
                follow_relation = UserFollow.objects.get(
                    user=request.user,
                    follows=target_user
                )
                # 有追蹤關係，檢查是否已確認
                is_following = follow_relation.confirm_or_not
                is_requested = not follow_relation.confirm_or_not
            except UserFollow.DoesNotExist:
                # 沒有追蹤關係
                is_following = False
                is_requested = False
            
            return APIResponse(
                data={
                    'is_following': is_following,
                    'is_requested': is_requested,
                    'account_privacy': target_user.account_privacy
                },
                message='獲取追蹤狀態成功',
                status=drf_status.HTTP_200_OK
            )
            
        except CustomUser.DoesNotExist:
            return APIResponse(
                message='找不到該使用者',
                code=drf_status.HTTP_404_NOT_FOUND,
                status=drf_status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return APIResponse(
                message=f'獲取追蹤狀態失敗: {str(e)}',
                code=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class FollowStatusBatchAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """批量獲取多個使用者的追蹤狀態"""
        try:
            user_ids = request.data.get('user_ids', [])
            
            if not user_ids:
                return APIResponse(
                    message='請提供使用者ID列表',
                    code=drf_status.HTTP_400_BAD_REQUEST,
                    status=drf_status.HTTP_400_BAD_REQUEST
                )
            
            # 獲取追蹤關係
            follow_relations = UserFollow.objects.filter(
                user=request.user,
                follows__id__in=user_ids
            ).select_related('follows')
            
            # 建立結果字典
            follow_status = {}
            for user_id in user_ids:
                follow_status[str(user_id)] = {
                    'is_following': False,
                    'is_requested': False
                }
            
            # 更新有追蹤關係的狀態
            for relation in follow_relations:
                user_id_str = str(relation.follows.id)
                if relation.confirm_or_not:
                    follow_status[user_id_str]['is_following'] = True
                else:
                    follow_status[user_id_str]['is_requested'] = True
            
            return APIResponse(
                data={'follow_status': follow_status},
                message='批量獲取追蹤狀態成功',
                status=drf_status.HTTP_200_OK
            )
            
        except Exception as e:
            return APIResponse(
                message=f'批量獲取追蹤狀態失敗: {str(e)}',
                code=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class FollowingListAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """獲取指定使用者的追蹤列表"""
        try:
            # 檢查是否有 user 參數（userAccount 或 userId）
            user_param = request.GET.get('user')
            if user_param:
                # 嘗試先用 user_account 查找，如果不行就用 id 查找
                try:
                    if user_param.isdigit():
                        target_user = User.objects.get(id=int(user_param))
                    else:
                        target_user = User.objects.get(user_account=user_param)
                except User.DoesNotExist:
                    return APIResponse(
                        message='找不到指定的用戶',
                        code=drf_status.HTTP_404_NOT_FOUND,
                        status=drf_status.HTTP_404_NOT_FOUND
                    )
                
                # 檢查隱私設定
                if target_user.account_privacy == 'private' and target_user != request.user:
                    # 檢查當前用戶是否已追蹤該私人帳戶
                    is_following = UserFollow.objects.filter(
                        user=request.user,
                        follows=target_user,
                        confirm_or_not=True
                    ).exists()
                    
                    if not is_following:
                        return APIResponse(
                            message='此用戶的追蹤列表為私密',
                            code=drf_status.HTTP_403_FORBIDDEN,
                            status=drf_status.HTTP_403_FORBIDDEN
                        )
            else:
                # 沒有 user 參數，獲取當前用戶的追蹤列表
                target_user = request.user
            
            following_relations = UserFollow.objects.filter(
                user=target_user,
                confirm_or_not=True
            ).select_related('follows')
            
            following_users = []
            for relation in following_relations:
                user_data = {
                    'id': relation.follows.id,
                    'user_account': relation.follows.user_account,
                    'username': relation.follows.username,
                    'user_fullname': relation.follows.user_fullname,
                    'headshot_url': relation.follows.headshot.firebase_url if hasattr(relation.follows, 'headshot') and relation.follows.headshot else None,
                    'account_privacy': relation.follows.account_privacy,
                    'date_followed': relation.date
                }
                following_users.append(user_data)
            
            return APIResponse(
                data=following_users,
                message='獲取追蹤列表成功',
                status=drf_status.HTTP_200_OK
            )
            
        except Exception as e:
            return APIResponse(
                message=f'獲取追蹤列表失敗: {str(e)}',
                code=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class FollowersListAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """獲取指定使用者的粉絲列表"""
        try:
            # 檢查是否有 user 參數（userAccount 或 userId）
            user_param = request.GET.get('user')
            if user_param:
                # 嘗試先用 user_account 查找，如果不行就用 id 查找
                try:
                    if user_param.isdigit():
                        target_user = User.objects.get(id=int(user_param))
                    else:
                        target_user = User.objects.get(user_account=user_param)
                except User.DoesNotExist:
                    return APIResponse(
                        message='找不到指定的用戶',
                        code=drf_status.HTTP_404_NOT_FOUND,
                        status=drf_status.HTTP_404_NOT_FOUND
                    )
                
                # 檢查隱私設定
                if target_user.account_privacy == 'private' and target_user != request.user:
                    # 檢查當前用戶是否已追蹤該私人帳戶
                    is_following = UserFollow.objects.filter(
                        user=request.user,
                        follows=target_user,
                        confirm_or_not=True
                    ).exists()
                    
                    if not is_following:
                        return APIResponse(
                            message='此用戶的粉絲列表為私密',
                            code=drf_status.HTTP_403_FORBIDDEN,
                            status=drf_status.HTTP_403_FORBIDDEN
                        )
            else:
                # 沒有 user 參數，獲取當前用戶的粉絲列表
                target_user = request.user
            
            follower_relations = UserFollow.objects.filter(
                follows=target_user,
                confirm_or_not=True  # 只獲取已確認的追蹤關係
            ).select_related('user')
            
            followers = []
            for relation in follower_relations:
                user_data = {
                    'id': relation.user.id,
                    'user_account': relation.user.user_account,
                    'username': relation.user.username,
                    'user_fullname': relation.user.user_fullname,
                    'headshot_url': relation.user.headshot.firebase_url if hasattr(relation.user, 'headshot') and relation.user.headshot else None,
                    'account_privacy': relation.user.account_privacy,
                    'date_followed': relation.date
                }
                followers.append(user_data)
            
            return APIResponse(
                data=followers,
                message='獲取粉絲列表成功',
                status=drf_status.HTTP_200_OK
            )
            
        except Exception as e:
            return APIResponse(
                message=f'獲取粉絲列表失敗: {str(e)}',
                code=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class RemoveFollowerAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def delete(self, request, user_account):
        """移除粉絲（單方面解除對方對你的追蹤關係）"""
        try:
            # 查找要移除的粉絲用戶
            try:
                follower_user = User.objects.get(user_account=user_account)
            except User.DoesNotExist:
                return APIResponse(
                    message='找不到指定的用戶',
                    code=drf_status.HTTP_404_NOT_FOUND,
                    status=drf_status.HTTP_404_NOT_FOUND
                )
            
            # 查找追蹤關係（該用戶追蹤當前用戶）
            try:
                follow_relation = UserFollow.objects.get(
                    user=follower_user,  # 粉絲用戶
                    follows=request.user,  # 當前用戶
                    confirm_or_not=True  # 只處理已確認的追蹤關係
                )
            except UserFollow.DoesNotExist:
                return APIResponse(
                    message='該用戶並非您的粉絲',
                    code=drf_status.HTTP_400_BAD_REQUEST,
                    status=drf_status.HTTP_400_BAD_REQUEST
                )
            
            # 刪除追蹤關係
            follow_relation.delete()
            
            # 刪除相關的通知（如果存在）
            try:
                FollowNotification.objects.filter(
                    user=request.user,
                    follow_request_from=follower_user,
                    notification_type__in=['follow_request', 'info']
                ).delete()
            except Exception as notification_error:
                # 刪除通知失敗不應該影響主要操作
                logger.warning(f'刪除相關通知時出現錯誤: {notification_error}')
            
            return APIResponse(
                data={
                    'removed_user': {
                        'id': follower_user.id,
                        'user_account': follower_user.user_account,
                        'user_fullname': follower_user.user_fullname
                    }
                },
                message=f'已成功移除粉絲 @{follower_user.user_account}',
                status=drf_status.HTTP_200_OK
            )
            
        except Exception as e:
            return APIResponse(
                message=f'移除粉絲失敗: {str(e)}',
                code=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )

# 通知相關API
class NotificationListAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """獲取當前使用者的所有通知"""
        try:
            



            notifications = FollowNotification.objects.filter(
                user=request.user
            )
            
            serializer = NotificationSerializer(notifications, many=True)
            
            # 統計未讀通知數量
            unread_count = notifications.filter(is_read=False).count()
            
            return APIResponse(
                data={
                    'notifications': serializer.data,
                    'unread_count': unread_count,
                    'total_count': notifications.count()
                },
                message='獲取通知列表成功',
                status=drf_status.HTTP_200_OK
            )
            
        except Exception as e:
            return APIResponse(
                message=f'獲取通知列表失敗: {str(e)}',
                code=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class MarkNotificationAsReadAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def patch(self, request, notification_id):
        """將指定通知標記為已讀"""
        try:
            notification = FollowNotification.objects.get(
                id=notification_id,
                user=request.user
            )
            
            notification.is_read = True
            notification.save()
            
            return APIResponse(
                message='通知已標記為已讀',
                status=drf_status.HTTP_200_OK
            )
            
        except FollowNotification.DoesNotExist:
            return APIResponse(
                message='找不到該通知',
                code=drf_status.HTTP_404_NOT_FOUND,
                status=drf_status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return APIResponse(
                message=f'標記通知失敗: {str(e)}',
                code=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class MarkAllNotificationsAsReadAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def patch(self, request):
        """將所有通知標記為已讀"""
        try:
            updated_count = FollowNotification.objects.filter(
                user=request.user,
                is_read=False
            ).update(is_read=True)
            
            return APIResponse(
                data={'updated_count': updated_count},
                message=f'已將 {updated_count} 個通知標記為已讀',
                status=drf_status.HTTP_200_OK
            )
            
        except Exception as e:
            return APIResponse(
                message=f'標記通知失敗: {str(e)}',
                code=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class FollowRequestResponseAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, notification_id):
        """回應追蹤請求（接受或拒絕）"""
        try:
            # 獲取通知
            notification = FollowNotification.objects.get(
                id=notification_id,
                user=request.user,
                notification_type='follow_request'
            )
            
            if not notification.related_follow:
                return APIResponse(
                    message='該通知沒有相關的追蹤請求',
                    code=drf_status.HTTP_400_BAD_REQUEST,
                    status=drf_status.HTTP_400_BAD_REQUEST
                )
            
            action = request.data.get('action')  # 'accept' 或 'reject'
            
            if action == 'accept':
                # 接受追蹤請求
                requester_username = notification.follow_request_from.username
                notification.related_follow.confirm_or_not = True
                notification.related_follow.save()
                
                # 刪除原通知
                notification.delete()
                
                # 創建新的info通知
                FollowNotification.objects.create(
                    user=request.user,
                    notification_type='info',
                    is_read=True,
                    content=f'您已確認 {requester_username} 的追蹤請求',
                    follow_request_from=notification.follow_request_from  # 關聯到相關用戶
                )
                
                return APIResponse(
                    message='已接受追蹤請求',
                    status=drf_status.HTTP_200_OK
                )
                
            elif action == 'reject':
                # 拒絕追蹤請求
                requester_username = notification.follow_request_from.username
                follow_relation = notification.related_follow
                
                # 刪除原通知和追蹤關係
                notification.delete()
                follow_relation.delete()
                
                # 創建新的info通知
                FollowNotification.objects.create(
                    user=request.user,
                    notification_type='info',
                    is_read=True,
                    content=f'您已拒絕 {requester_username} 的追蹤請求',
                    follow_request_from=notification.follow_request_from  # 關聯到相關用戶
                )
                
                return APIResponse(
                    message='已拒絕追蹤請求',
                    status=drf_status.HTTP_200_OK
                )
            else:
                return APIResponse(
                    message='無效的操作，請使用 "accept" 或 "reject"',
                    code=drf_status.HTTP_400_BAD_REQUEST,
                    status=drf_status.HTTP_400_BAD_REQUEST
                )
                
        except FollowNotification.DoesNotExist:
            return APIResponse(
                message='找不到該追蹤請求通知',
                code=drf_status.HTTP_404_NOT_FOUND,
                status=drf_status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return APIResponse(
                message=f'處理追蹤請求失敗: {str(e)}',
                code=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
                status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR
            )