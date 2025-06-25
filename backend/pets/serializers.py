from rest_framework import serializers
from .models import *
from media.models import Image
from interactions.serializers import InteractionStatusSerializer
from django.contrib.contenttypes.models import ContentType

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
                 'body_temperature', 'water_amount', 'created_at', 
                 'updated_at', 'symptoms', 'images']
    
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
        """獲取異常記錄關聯的所有圖片 - Firebase Storage 版本"""
        from django.contrib.contenttypes.models import ContentType
        content_type = ContentType.objects.get_for_model(AbnormalPost)
        images = Image.objects.filter(
            content_type=content_type,
            object_id=obj.id
        ).order_by('sort_order')
        
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

# === IllnessArchive (病程紀錄) ===
class IllnessArchiveSerializer(serializers.ModelSerializer):
    pet_name = serializers.CharField(source='pet.pet_name', read_only=True)
    user_name = serializers.CharField(source='user.username', read_only=True)
    illnesses_data = serializers.SerializerMethodField()
    interaction_stats = serializers.SerializerMethodField()
    user_interaction = serializers.SerializerMethodField()
    
    class Meta:
        model = IllnessArchiveContent
        fields = [
            'id', 'pet', 'pet_name', 'user', 'user_name', 'archive_title',
            'post_date', 'content', 'popularity', 'go_to_doctor', 'health_status',
            'updated_at', 'illnesses_data', 'interaction_stats', 'user_interaction'
        ]
    
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
        return obj.get_interaction_stats()
    
    def get_user_interaction(self, obj):
        """獲取當前用戶與疾病檔案的互動狀態"""
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            user = request.user
            return {
                'is_upvoted': obj.check_user_interaction(user, 'upvoted'),
                'is_downvoted': obj.check_user_interaction(user, 'downvoted'),
                'is_saved': obj.check_user_interaction(user, 'saved'),
                'is_shared': obj.check_user_interaction(user, 'shared')
            }
        return {
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
