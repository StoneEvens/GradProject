from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate
from django.utils.translation import gettext_lazy as _
from .models import *
import logging
from rest_framework_simplejwt.tokens import RefreshToken

# 設置日誌記錄器
logger = logging.getLogger(__name__)

# 用戶基本信息序列化器（用於評論等顯示）
class UserBasicSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'user_fullname', 'user_account']

# 自定義 TokenObtainPairSerializer 以包含用戶資料
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = 'email'
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['password'] = serializers.CharField(
            write_only=True, style={'input_type': 'password'}
        )
        self.fields['email'] = serializers.EmailField()
        self.fields.pop('username', None)  # 移除 username 字段
    
    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')
        
        # 添加日誌記錄開始驗證過程
        logger.info(f"開始驗證用戶登入：{email}")
        
        if email and password:
            try:
                user = CustomUser.objects.get(email=email)
                logger.info(f"找到帳戶：{user.username}, 活躍狀態：{user.is_active}")
                
                # 檢查帳戶是否活躍
                if not user.is_active:
                    logger.warning(f"帳戶 {email} 已停用")
                    msg = _('此帳戶已被停用，請聯繫管理員。')
                    raise serializers.ValidationError(msg, code='account_disabled')
                
                # 使用 user_obj.username 作為 Django 的認證用戶名
                authenticated_user = authenticate(username=user.username, password=password)
                
                if not authenticated_user:
                    logger.warning(f"帳戶 {email} 認證失敗，密碼不正確")
                    msg = _('密碼不正確，請重新嘗試。')
                    raise serializers.ValidationError(msg, code='invalid_password')
                
                # 如果驗證成功，記錄日誌
                logger.info(f"用戶 {email} 登入成功")
                
                # 直接生成令牌，而不調用父類方法
                refresh = RefreshToken.for_user(authenticated_user)
                
                data = {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                }
                
                # 添加自定義響應數據
                serializer = UserLoginSerializer(authenticated_user)
                data['user'] = serializer.data
                data['message'] = '登入成功'
                return data
                
            except CustomUser.DoesNotExist:
                logger.warning(f"嘗試使用不存在的電子郵件登入：{email}")
                msg = _('未找到該電子郵件的帳戶。')
                raise serializers.ValidationError(msg, code='account_not_found')
        else:
            missing_fields = []
            if not email:
                missing_fields.append("email")
            if not password:
                missing_fields.append("password")
            
            logger.warning(f"登入嘗試缺少必要欄位：{', '.join(missing_fields)}")
            msg = _('必須包含 "email" 和 "password"。')
            raise serializers.ValidationError(msg, code='authorization')

class UserLoginSerializer(serializers.ModelSerializer):
    #登入成功時回傳的基本資訊
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email']

class UserProfileSerializer(serializers.ModelSerializer):
    headshot_url = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'headshot_url', 'user_fullname', 'user_account', 'points', 'user_intro']
        read_only_fields = ['id', 'points', 'user_account']

    def get_headshot_url(self, obj):
        try:
            return obj.headshot.img_url
        except:
            return None

class UserSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    user_fullname = serializers.CharField()
    user_intro = serializers.CharField(allow_blank=True, allow_null=True)
    followers_count = serializers.IntegerField()
    following_count = serializers.IntegerField()
    posts_count = serializers.IntegerField()

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'

class UserFollowSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserFollow
        fields = '__all__'

class UserBlockSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserBlock
        fields = '__all__'

class MissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Mission
        fields = '__all__'

class UserMissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserMission
        fields = '__all__'

class AchievementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Achievement
        fields = '__all__'

class UserAchievementSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserAchievement
        fields = '__all__'

class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = ['id', 'title', 'description', 'date', 'start_time', 'end_time', 'is_completed']

