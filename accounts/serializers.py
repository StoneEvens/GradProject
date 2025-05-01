from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate
from django.utils.translation import gettext_lazy as _
from .models import *

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
        
        if email and password:
            try:
                user = CustomUser.objects.get(email=email)
                # 使用 user_obj.username 作為 Django 的認證用戶名
                user = authenticate(username=user.username, password=password)
                
                if not user:
                    msg = _('無法使用提供的憑證登入。')
                    raise serializers.ValidationError(msg, code='authorization')
                
            except CustomUser.DoesNotExist:
                msg = _('未找到該電子郵件的帳戶。')
                raise serializers.ValidationError(msg, code='authorization')
        else:
            msg = _('必須包含 "email" 和 "password"。')
            raise serializers.ValidationError(msg, code='authorization')
            
        # 設置用戶以用於 parent class validate 方法
        self.user = user
        data = super().validate(attrs)
        
        # 添加自定義響應數據
        serializer = UserLoginSerializer(user)
        data['user'] = serializer.data
        data['message'] = '登入成功'
        return data

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
        fields = ['id', 'title', 'description', 'date', 'is_completed']

