from rest_framework import serializers
from .models import *
from interactions.serializers import InteractionStatusSerializer

# === Pet (寵物基本資料) ===
class PetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pet
        fields = '__all__'

# === AbnormalPost (異常紀錄) ===
class AbnormalPostSerializer(serializers.ModelSerializer):
    pet_name = serializers.CharField(source='pet.pet_name', read_only=True)
    symptoms = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    
    class Meta:
        model = AbnormalPost
        fields = ['id', 'pet', 'pet_name', 'user', 'content', 'weight', 
                 'body_temperature', 'water_amount', 'is_emergency', 'record_date',
                 'created_at', 'updated_at', 'symptoms', 'images', 'is_private']
    
    def get_symptoms(self, obj):
        """獲取異常記錄關聯的所有症狀"""
        symptoms_relations = PostSymptomsRelation.objects.filter(post=obj).select_related('symptom')
        symptoms_data = []
        for relation in symptoms_relations:
            symptoms_data.append({
                'id': relation.symptom.id,
                'symptom_name': relation.symptom.symptom_name
            })
        return symptoms_data
    
    def get_images(self, obj):
        """獲取異常記錄關聯的所有圖片 - 使用 AbnormalPostImage 模型"""
        images = obj.abnormal_images.all().order_by('sort_order')
        
        images_data = []
        for image in images:
            images_data.append({
                'id': image.id,
                'firebase_url': image.firebase_url,
                'firebase_path': image.firebase_path,
                'url': image.url,  # 使用模型的 url 屬性
                'alt_text': image.alt_text
            })
        return images_data

# === PublicAbnormalPost (公開異常紀錄詳情) ===
class PublicAbnormalPostSerializer(serializers.ModelSerializer):
    """公開異常記錄序列化器 - 包含完整的用戶和寵物資訊用於公開瀏覽"""
    pet_name = serializers.CharField(source='pet.pet_name', read_only=True)
    symptoms = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    pet_info = serializers.SerializerMethodField()
    user_info = serializers.SerializerMethodField()
    
    class Meta:
        model = AbnormalPost
        fields = ['id', 'pet', 'pet_name', 'user', 'content', 'weight', 
                 'body_temperature', 'water_amount', 'is_emergency', 'record_date',
                 'created_at', 'updated_at', 'symptoms', 'images', 'is_private',
                 'pet_info', 'user_info']
    
    def get_symptoms(self, obj):
        """獲取異常記錄關聯的所有症狀"""
        symptoms_relations = PostSymptomsRelation.objects.filter(post=obj).select_related('symptom')
        symptoms_data = []
        for relation in symptoms_relations:
            symptoms_data.append({
                'id': relation.symptom.id,
                'symptom_name': relation.symptom.symptom_name
            })
        return symptoms_data
    
    def get_images(self, obj):
        """獲取異常記錄關聯的所有圖片"""
        images = obj.abnormal_images.all().order_by('sort_order')
        
        images_data = []
        for image in images:
            images_data.append({
                'id': image.id,
                'firebase_url': image.firebase_url,
                'firebase_path': image.firebase_path,
                'url': image.url,
                'alt_text': image.alt_text
            })
        return images_data
    
    def get_pet_info(self, obj):
        """獲取寵物詳細資訊"""
        if not obj.pet:
            return None
        
        pet_headshot_url = None
        if hasattr(obj.pet, 'headshot') and obj.pet.headshot:
            pet_headshot_url = obj.pet.headshot.firebase_url
        
        return {
            'pet_id': obj.pet.id,
            'id': obj.pet.id,
            'pet_name': obj.pet.pet_name,
            'breed': obj.pet.breed,
            'pet_type': obj.pet.pet_type, 
            'age': obj.pet.age,
            'weight': obj.pet.weight,
            'headshot_url': pet_headshot_url
        }
    
    def get_user_info(self, obj):
        """獲取用戶詳細資訊"""
        if not obj.user:
            return None
        
        user_headshot_url = None
        if hasattr(obj.user, 'headshot') and obj.user.headshot:
            user_headshot_url = obj.user.headshot.firebase_url
        
        return {
            'user_fullname': obj.user.user_fullname,
            'user_account': obj.user.user_account,
            'headshot_url': user_headshot_url
        }

# === AbnormalPostPreview (異常紀錄預覽) ===
class AbnormalPostPreviewSerializer(serializers.ModelSerializer):
    """異常記錄預覽序列化器 - 只返回基本信息用於列表顯示"""
    symptoms = serializers.SerializerMethodField()
    
    class Meta:
        model = AbnormalPost
        fields = ['id', 'record_date', 'is_emergency', 'symptoms']
    
    def get_symptoms(self, obj):
        """獲取異常記錄關聯的所有症狀名稱"""
        # 使用預載的關係，避免額外查詢
        return [relation.symptom.symptom_name for relation in obj.symptoms.all()]

# === Symptom (症狀) ===
class SymptomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Symptom
        fields = '__all__'

# === PostSymptomsRelation (異常紀錄和症狀關聯) ===
class PostSymptomsRelationSerializer(serializers.ModelSerializer):
    """異常紀錄和症狀之間的關聯序列化器"""
    symptom_name = serializers.CharField(source='symptom.symptom_name', read_only=True)
    
    class Meta:
        model = PostSymptomsRelation
        fields = ['id', 'post', 'symptom', 'symptom_name']

# === Illness (病因) ===
class IllnessSerializer(serializers.ModelSerializer):
    class Meta:
        model = Illness
        fields = '__all__'

# === DiseaseArchiveContent (疾病檔案內容) ===
class DiseaseArchiveContentSerializer(serializers.ModelSerializer):
    pet_name = serializers.CharField(source='pet.pet_name', read_only=True)
    user = serializers.CharField(source='postFrame.user')
    user_name = serializers.CharField(source='user.username', read_only=True)
    post_date = serializers.DateTimeField(source='postFrame.created_at', read_only=True)
    updated_at = serializers.DateTimeField(source='postFrame.updated_at', read_only=True)
    generated_content = serializers.CharField(source='content', read_only=True)  # 前端期望的欄位名稱
    pet_info = serializers.SerializerMethodField()  # 前端期望的寵物資訊格式
    user_info = serializers.SerializerMethodField()  # 前端期望的用戶資訊格式
    illness_names = serializers.SerializerMethodField()  # 前端期望的疾病名稱陣列
    illnesses_data = serializers.SerializerMethodField()
    interaction_stats = serializers.SerializerMethodField()
    user_interaction = serializers.SerializerMethodField()
    
    class Meta:
        model = DiseaseArchiveContent
        fields = [
            'id', 'pet', 'pet_name', 'user', 'user_name', 'archive_title',
            'post_date', 'content', 'generated_content', 'go_to_doctor', 'health_status',
            'updated_at', 'pet_info', 'user_info', 'illness_names', 'illnesses_data', 
            'interaction_stats', 'user_interaction', 'is_private', 'postFrame'
        ]
    
    def get_pet_info(self, obj):
        """獲取寵物資訊（前端期望格式）"""
        if not obj.pet:
            return None
        
        pet_headshot_url = None
        if hasattr(obj.pet, 'headshot') and obj.pet.headshot:
            pet_headshot_url = obj.pet.headshot.firebase_url
        
        return {
            'pet_id': obj.pet.id,
            'id': obj.pet.id,  # 兼容性
            'pet_name': obj.pet.pet_name,
            'breed': obj.pet.breed,
            'pet_type': obj.pet.pet_type,
            'headshot_url': pet_headshot_url
        }
    
    def get_user_info(self, obj):
        """獲取用戶資訊（前端期望格式）"""
        if not obj.postFrame or not obj.postFrame.user:
            return None
        
        user = obj.postFrame.user
        user_headshot_url = None
        if hasattr(user, 'headshot') and user.headshot:
            user_headshot_url = user.headshot.firebase_url
        
        return {
            'user_fullname': user.user_fullname,
            'user_account': user.user_account,
            'headshot_url': user_headshot_url
        }
    
    def get_illness_names(self, obj):
        """獲取疾病名稱陣列（前端期望格式）"""
        illness_relations = ArchiveIllnessRelation.objects.filter(archive=obj).select_related('illness')
        return [relation.illness.illness_name for relation in illness_relations]
    
    def get_illnesses_data(self, obj):
        """獲取疾病檔案關聯的所有病因"""
        illness_relations = ArchiveIllnessRelation.objects.filter(archive=obj).select_related('illness')
        illnesses_data = []
        for relation in illness_relations:
            illnesses_data.append({
                'id': relation.illness.id,
                'illness_name': relation.illness.illness_name
            })
        return illnesses_data
    
    def get_interaction_stats(self, obj):
        """獲取疾病檔案的互動統計"""
        from comments.models import Comment
        stats = obj.get_interaction_stats()
        # 動態計算留言總數（包含回覆）
        comment_count = 0
        if obj.postFrame:
            comment_count = Comment.objects.filter(postFrame=obj.postFrame).count()
        
        # 將陣列格式轉換為物件格式 [upvotes, downvotes, saves, shares, likes]
        return {
            'upvotes': stats[0],
            'downvotes': stats[1], 
            'saves': stats[2],
            'shares': stats[3],
            'likes': stats[4],
            'comments': comment_count
        }
    
    def get_user_interaction(self, obj):
        """獲取當前用戶與疾病檔案的互動狀態"""
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            user = request.user
            return {
                'is_liked': obj.check_user_interaction(user, 'liked'),
                'is_upvoted': obj.check_user_interaction(user, 'upvoted'),
                'is_downvoted': obj.check_user_interaction(user, 'downvoted'),
                'is_saved': obj.check_user_interaction(user, 'saved'),
                'is_shared': obj.check_user_interaction(user, 'shared')
            }
        return {
            'is_liked': False,
            'is_upvoted': False,
            'is_downvoted': False,
            'is_saved': False,
            'is_shared': False
        }

# === ArchiveAbnormalPostRelation (病程紀錄和異常紀錄的關聯) ===
class ArchiveAbnormalPostRelationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ArchiveAbnormalPostRelation
        fields = '__all__'

# === ArchiveIllnessRelation (病程紀錄和病因的關聯) ===
class ArchiveIllnessRelationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ArchiveIllnessRelation
        fields = '__all__'

# === DiseaseArchiveSearchSerializer (搜尋用的簡化版序列化器) ===
class DiseaseArchiveSearchSerializer(serializers.ModelSerializer):
    # 基本資料
    pet_name = serializers.CharField(source='pet.pet_name', read_only=True)
    pet_type = serializers.CharField(source='pet.pet_type', read_only=True)
    user_account = serializers.CharField(source='postFrame.user.user_account', read_only=True)
    user_fullname = serializers.CharField(source='postFrame.user.user_fullname', read_only=True)
    post_date = serializers.DateTimeField(source='postFrame.created_at', read_only=True)
    illness_names = serializers.SerializerMethodField()
    
    # ArchiveList 元件所需的額外欄位
    user_info = serializers.SerializerMethodField()
    pet_info = serializers.SerializerMethodField()
    interaction_stats = serializers.SerializerMethodField()
    user_interaction = serializers.SerializerMethodField()
    postFrame = serializers.IntegerField(source='postFrame.id', read_only=True)
    
    class Meta:
        model = DiseaseArchiveContent
        fields = [
            'id', 'archive_title', 'content', 'pet_name', 'pet_type',
            'user_account', 'user_fullname', 'post_date', 'go_to_doctor',
            'health_status', 'illness_names', 'user_info', 'pet_info',
            'interaction_stats', 'user_interaction', 'postFrame', 'is_private'
        ]
    
    def get_illness_names(self, obj):
        """獲取疾病名稱陣列"""
        illness_relations = ArchiveIllnessRelation.objects.filter(archive=obj).select_related('illness')
        return [relation.illness.illness_name for relation in illness_relations]
    
    def get_user_info(self, obj):
        """獲取用戶資訊（ArchiveList 需要的格式）"""
        if not obj.postFrame or not obj.postFrame.user:
            return None
        
        user = obj.postFrame.user
        user_headshot_url = None
        if hasattr(user, 'headshot') and user.headshot:
            user_headshot_url = user.headshot.firebase_url
        
        return {
            'user_fullname': user.user_fullname,
            'user_account': user.user_account,
            'headshot_url': user_headshot_url
        }
    
    def get_pet_info(self, obj):
        """獲取寵物資訊（ArchiveList 需要的格式）"""
        if not obj.pet:
            return None
        
        pet_headshot_url = None
        if hasattr(obj.pet, 'headshot') and obj.pet.headshot:
            pet_headshot_url = obj.pet.headshot.firebase_url
        
        return {
            'pet_id': obj.pet.id,
            'id': obj.pet.id,
            'pet_name': obj.pet.pet_name,
            'breed': obj.pet.breed,
            'pet_type': obj.pet.pet_type,
            'headshot_url': pet_headshot_url
        }
    
    def get_interaction_stats(self, obj):
        """獲取互動統計"""
        from comments.models import Comment
        stats = obj.get_interaction_stats()
        comment_count = 0
        if obj.postFrame:
            comment_count = Comment.objects.filter(postFrame=obj.postFrame).count()
        
        return {
            'upvotes': stats[0],
            'downvotes': stats[1],
            'saves': stats[2],
            'shares': stats[3],
            'likes': stats[4],
            'comments': comment_count
        }
    
    def get_user_interaction(self, obj):
        """獲取當前用戶與檔案的互動狀態"""
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            user = request.user
            return {
                'is_liked': obj.check_user_interaction(user, 'liked'),
                'is_upvoted': obj.check_user_interaction(user, 'upvoted'),
                'is_downvoted': obj.check_user_interaction(user, 'downvoted'),
                'is_saved': obj.check_user_interaction(user, 'saved'),
                'is_shared': obj.check_user_interaction(user, 'shared')
            }
        return {
            'is_liked': False,
            'is_upvoted': False,
            'is_downvoted': False,
            'is_saved': False,
            'is_shared': False
        }
