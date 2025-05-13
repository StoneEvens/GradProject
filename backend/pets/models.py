from datetime import date
from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from rest_framework import status as drf_status

class Pet(models.Model):
    PET_STAGE_CHOICES = [
        ('puppy', '幼犬'),
        ('adult', '成犬/成貓'),
        ('pregnant', '懷孕期'),
        ('lactating', '哺乳期'),
        ('kitten', '幼貓'),
    ]

    pet_name = models.CharField(max_length=100)
    pet_type = models.CharField(max_length=100)  
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='pets'
    )

    age = models.IntegerField(null=True, blank=True, help_text="年齡 (歲)")
    breed = models.CharField(max_length=100, null=True, blank=True, help_text="品種")

    weight = models.FloatField(null=True, blank=True, help_text="體重 (公斤)")
    height = models.FloatField(null=True, blank=True, help_text="身高 (公分)")
    pet_stage = models.CharField(max_length=20, choices=PET_STAGE_CHOICES, null=True, blank=True, help_text="年齡階段")
    predicted_adult_weight = models.FloatField(null=True, blank=True, help_text="預期成犬/成貓體重 (公斤)")

    def __str__(self):
        return f"{self.pet_name} ({self.pet_type})"

    @property
    def all_illness_names(self):
        """獲取此寵物所有病程記錄中的獨特疾病名稱列表。"""
        names = set()
        # 確保在調用此屬性前，相關的 illness_archives 和 illnesses__illness 已被預加載 (prefetched)
        # 以獲得最佳性能，否則會觸發 N+1 查詢。
        # 例如: Pet.objects.prefetch_related('illness_archives__illnesses__illness')
        for archive in self.illness_archives.all(): # illness_archives 是 Pet 到 IllnessArchive 的 related_name
            for relation in archive.illnesses.all(): # illnesses 是 IllnessArchive 到 ArchiveIllnessRelation 的 related_name
                if hasattr(relation, 'illness') and hasattr(relation.illness, 'illness_name'):
                    names.add(relation.illness.illness_name)
        return list(names)

# 寵物對各種貼文/異常紀錄的多型關聯
class PetGenericRelation(models.Model):
    pet = models.ForeignKey(
        'Pet',
        on_delete=models.CASCADE,
        related_name='generic_relations'
    )
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')

    class Meta:
        unique_together = ('pet', 'content_type', 'object_id')

    def __str__(self):
        return f"Pet {self.pet.pet_name} in {self.content_type} {self.object_id}"

# 健康異常日誌（異常貼文）
class AbnormalPost(models.Model):
    pet = models.ForeignKey('Pet', on_delete=models.CASCADE, related_name='abnormal_posts')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='abnormal_posts')
    content = models.TextField()
    weight = models.FloatField()
    body_temperature = models.FloatField()
    water_amount = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"AbnormalPost {self.id} for Pet {self.pet.pet_name}"

    def add_symptoms_by_ids(self, symptom_ids):
        """根據症狀ID列表為此異常記錄添加症狀關聯。"""
        added_symptoms_count = 0
        symptom_instances = []
        if not isinstance(symptom_ids, list):
            # 或者可以記錄一個警告，或者返回一個錯誤指示
            return 0, [] 

        for symptom_id in symptom_ids:
            try:
                symptom = Symptom.objects.get(id=symptom_id)
                _, created = PostSymptomsRelation.objects.get_or_create(
                    post=self,
                    symptom=symptom
                )
                if created:
                    added_symptoms_count += 1
                symptom_instances.append(symptom)
            except Symptom.DoesNotExist:
                # 可以選擇記錄日誌 logger.warning(f"AbnormalPost {self.id}: 嘗試關聯不存在的症狀 ID: {symptom_id}")
                pass # 忽略不存在的症狀ID，或根據需求拋出錯誤
            except Exception as e:
                # logger.error(f"AbnormalPost {self.id}: 添加症狀 {symptom_id} 時出錯: {e}")
                pass # 其他可能的錯誤
        return added_symptoms_count, symptom_instances

# 異常貼文中的症狀
class Symptom(models.Model):
    symptom_name = models.CharField(max_length=100)

    def __str__(self):
        return self.symptom_name

# 異常貼文和症狀的關聯
class PostSymptomsRelation(models.Model):
    post = models.ForeignKey(AbnormalPost, on_delete=models.CASCADE, related_name='symptoms')
    symptom = models.ForeignKey(Symptom, on_delete=models.CASCADE, related_name='posts')

    class Meta:
        unique_together = ('post', 'symptom')

    def __str__(self):
        return f"Post {self.post.id} - Symptom {self.symptom.symptom_name}"

# 病因
class Illness(models.Model):
    illness_name = models.CharField(max_length=100)

    def __str__(self):
        return self.illness_name

# 病程紀錄（IllnessArchive）
class IllnessArchive(models.Model):
    pet = models.ForeignKey('Pet', on_delete=models.CASCADE, related_name='illness_archives')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='illness_archives')
    archive_title = models.CharField(max_length=100)
    post_date = models.DateField(default=date.today)
    content = models.TextField()
    popularity = models.IntegerField(default=0)
    go_to_doctor = models.BooleanField(default=False)
    health_status = models.CharField(max_length=100)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Archive: {self.archive_title} for {self.pet.pet_name}"
        
    def handle_interaction(self, user, relation, allowed_relations):
        """處理用戶對此疾病檔案的互動，並更新熱度。"""
        from interactions.models import UserInteraction # 延遲導入
        from django.contrib.contenttypes.models import ContentType

        if relation not in allowed_relations:
            return False, f"互動類型 '{relation}' 無效，僅支持 {', '.join(allowed_relations)}", drf_status.HTTP_400_BAD_REQUEST

        content_type = ContentType.objects.get_for_model(self.__class__)
        interaction = UserInteraction.objects.filter(
            user=user,
            content_type=content_type,
            object_id=self.id,
            relation=relation
        ).first()

        action_taken_message = ""
        status_code = drf_status.HTTP_200_OK
        popularity_changed = False

        if interaction: # 取消互動
            interaction.delete()
            action_taken_message = f"已取消對 {self.archive_title} 的 {relation}"
            if relation == 'upvoted':
                self.popularity = max(0, self.popularity - 1)
                popularity_changed = True
            elif relation == 'downvoted': # 如果倒讚也影響熱度 (例如熱度 = 讚 - 倒讚)
                self.popularity += 1 # 移除倒讚，熱度可能增加
                popularity_changed = True
        
        else: # 新增互動
            status_code = drf_status.HTTP_201_CREATED
            # 處理互斥 (例如：點讚和倒讚)
            if relation in ['upvoted', 'downvoted']:
                opposite_relation = 'downvoted' if relation == 'upvoted' else 'upvoted'
                opposite_interaction = UserInteraction.objects.filter(
                    user=user,
                    content_type=content_type,
                    object_id=self.id,
                    relation=opposite_relation
                ).first()
                if opposite_interaction:
                    opposite_interaction.delete()
                    if opposite_relation == 'downvoted' and relation == 'upvoted': # 移除了踩，現在要按讚
                        self.popularity += 1 # 抵銷之前踩的影響
                        popularity_changed = True
                    elif opposite_relation == 'upvoted' and relation == 'downvoted': # 移除了讚，現在要踩
                        self.popularity = max(0, self.popularity -1) # 抵銷之前讚的影響
                        popularity_changed = True
            
            UserInteraction.objects.create(
                user=user,
                content_type=content_type,
                object_id=self.id,
                relation=relation
            )
            action_taken_message = f"已成功對 {self.archive_title} {relation}"
            if relation == 'upvoted':
                self.popularity += 1
                popularity_changed = True
            elif relation == 'downvoted':
                self.popularity = max(0, self.popularity - 1) 
                popularity_changed = True
        
        if popularity_changed:
            self.save(update_fields=['popularity'])
        
        return True, action_taken_message, status_code

    def get_interaction_stats(self):
        """
        獲取疾病檔案的互動統計
        """
        from interactions.models import UserInteraction
        
        archive_type = ContentType.objects.get_for_model(IllnessArchive)
        
        upvotes = UserInteraction.objects.filter(
            content_type=archive_type,
            object_id=self.id,
            relation='upvoted'
        ).count()
        
        downvotes = UserInteraction.objects.filter(
            content_type=archive_type,
            object_id=self.id,
            relation='downvoted'
        ).count()
        
        saves = UserInteraction.objects.filter(
            content_type=archive_type,
            object_id=self.id,
            relation='saved'
        ).count()
        
        shares = UserInteraction.objects.filter(
            content_type=archive_type,
            object_id=self.id,
            relation='shared'
        ).count()
        
        return {
            'upvotes': upvotes,
            'downvotes': downvotes,
            'saves': saves,
            'shares': shares,
            'total_score': upvotes - downvotes
        }
    
    def check_user_interaction(self, user, relation):
        """
        檢查用戶是否對疾病檔案有特定互動
        """
        if not user or not user.is_authenticated:
            return False
            
        from interactions.models import UserInteraction
        
        archive_type = ContentType.objects.get_for_model(IllnessArchive)
        return UserInteraction.objects.filter(
            user=user,
            content_type=archive_type,
            object_id=self.id,
            relation=relation
        ).exists()

# 病程紀錄和異常貼文的關聯
class ArchiveAbnormalPostRelation(models.Model):
    archive = models.ForeignKey(
        IllnessArchive,
        on_delete=models.CASCADE,
        related_name='abnormal_posts'
    )
    post = models.ForeignKey(
        AbnormalPost,
        on_delete=models.CASCADE,
        related_name='archive_links'
    )

    class Meta:
        unique_together = ('archive', 'post')

    def __str__(self):
        return f"Archive {self.archive.id} linked to AbnormalPost {self.post.id}"

# 病程紀錄和病因的關聯
class ArchiveIllnessRelation(models.Model):
    archive = models.ForeignKey(IllnessArchive, on_delete=models.CASCADE, related_name='illnesses')
    illness = models.ForeignKey(Illness, on_delete=models.CASCADE, related_name='archives')

    class Meta:
        unique_together = ('archive', 'illness')

    def __str__(self):
        return f"{self.archive.archive_title} - {self.illness.illness_name}"

# 病程紀錄和症狀的關聯
class ArchiveSymptomsRelation(models.Model):
    archive = models.ForeignKey(IllnessArchive, on_delete=models.CASCADE, related_name='symptoms')
    symptom = models.ForeignKey(Symptom, on_delete=models.CASCADE, related_name='illness_archives')

    class Meta:
        unique_together = ('archive', 'symptom')

    def __str__(self):
        return f"{self.archive.archive_title} - {self.symptom.symptom_name}"

