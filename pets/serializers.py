from rest_framework import serializers
from .models import *

# === Pet (寵物基本資料) ===
class PetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pet
        fields = '__all__'

# === PetGenericRelation (寵物的通用貼文關聯) ===
class PetGenericRelationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PetGenericRelation
        fields = '__all__'

# === AbnormalPost (異常紀錄) ===
class AbnormalPostSerializer(serializers.ModelSerializer):
    class Meta:
        model = AbnormalPost
        fields = '__all__'

# === Symptom (症狀) ===
class SymptomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Symptom
        fields = '__all__'

# === PostSymptomsRelation (異常紀錄和症狀關聯) ===
class PostSymptomsRelationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostSymptomsRelation
        fields = '__all__'

# === Illness (病因) ===
class IllnessSerializer(serializers.ModelSerializer):
    class Meta:
        model = Illness
        fields = '__all__'

# === IllnessArchive (病程紀錄) ===
class IllnessArchiveSerializer(serializers.ModelSerializer):
    class Meta:
        model = IllnessArchive
        fields = '__all__'

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

# === ArchiveSymptomsRelation (病程紀錄和症狀的關聯) ===
class ArchiveSymptomsRelationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ArchiveSymptomsRelation
        fields = '__all__'
