from rest_framework import serializers
from .models import *

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

