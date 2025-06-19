from django.contrib import admin
from .models import (
    Pet, PetGenericRelation, AbnormalPost, Symptom, PostSymptomsRelation,
    Illness, IllnessArchiveContent, ArchiveAbnormalPostRelation, ArchiveIllnessRelation
)

# 寵物管理
@admin.register(Pet)
class PetAdmin(admin.ModelAdmin):
    list_display = ('pet_name', 'pet_type', 'breed', 'owner', 'age', 'weight', 'pet_stage')
    list_filter = ('pet_type', 'pet_stage')
    search_fields = ('pet_name', 'pet_type', 'breed', 'owner__username')

# 寵物通用關係管理
@admin.register(PetGenericRelation)
class PetGenericRelationAdmin(admin.ModelAdmin):
    list_display = ('pet', 'content_type', 'object_id')
    list_filter = ('content_type',)
    search_fields = ('pet__pet_name',)

# 異常貼文管理
@admin.register(AbnormalPost)
class AbnormalPostAdmin(admin.ModelAdmin):
    list_display = ('id', 'pet', 'user', 'weight', 'body_temperature', 'water_amount', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('pet__pet_name', 'user__username', 'content')
    readonly_fields = ('created_at', 'updated_at')

# 症狀管理
@admin.register(Symptom)
class SymptomAdmin(admin.ModelAdmin):
    list_display = ('symptom_name',)
    search_fields = ('symptom_name',)

# 異常貼文症狀關係管理
@admin.register(PostSymptomsRelation)
class PostSymptomsRelationAdmin(admin.ModelAdmin):
    list_display = ('post', 'symptom')
    list_filter = ('symptom',)
    search_fields = ('post__id', 'symptom__symptom_name')

# 病因管理
@admin.register(Illness)
class IllnessAdmin(admin.ModelAdmin):
    list_display = ('illness_name',)
    search_fields = ('illness_name',)

# 病程紀錄管理
@admin.register(IllnessArchiveContent)
class IllnessArchiveAdmin(admin.ModelAdmin):
    list_display = ('archive_title', 'pet', 'go_to_doctor', 'health_status', 'content', 'postFrame')
    list_filter = ('go_to_doctor', 'health_status')
    search_fields = ('archive_title', 'pet__pet_name', 'user__username', 'content')

# 病程紀錄和異常貼文關係管理
@admin.register(ArchiveAbnormalPostRelation)
class ArchiveAbnormalPostRelationAdmin(admin.ModelAdmin):
    list_display = ('archive', 'post')
    search_fields = ('archive__archive_title', 'post__id')

# 病程紀錄和病因關係管理
@admin.register(ArchiveIllnessRelation)
class ArchiveIllnessRelationAdmin(admin.ModelAdmin):
    list_display = ('archive', 'illness')
    list_filter = ('illness',)
    search_fields = ('archive__archive_title', 'illness__illness_name')
