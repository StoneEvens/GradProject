from datetime import date
from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from rest_framework import status as drf_status

#----------寵物本身----------

class Pet(models.Model):
    PET_STAGE_CHOICES = [('puppy', '幼犬'), ('adult', '成犬/成貓'), ('pregnant', '懷孕期'), ('lactating', '哺乳期'), ('kitten', '幼貓'),]

    age = models.IntegerField(null=True, blank=True, help_text="年齡 (歲)")
    breed = models.CharField(max_length=100, null=True, blank=True, help_text="品種")
    height = models.FloatField(null=True, blank=True, help_text="身高 (公分)")
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='pets')
    pet_name = models.CharField(max_length=100)
    pet_stage = models.CharField(max_length=20, choices=PET_STAGE_CHOICES, null=True, blank=True, help_text="年齡階段")
    pet_type = models.CharField(max_length=100)  
    predicted_adult_weight = models.FloatField(null=True, blank=True, help_text="預期成犬/成貓體重 (公斤)")
    weight = models.FloatField(null=True, blank=True, help_text="體重 (公斤)")

    def __str__(self):
        return f"{self.pet_name} ({self.pet_type})"

    #Removed 獲取此寵物所有病程記錄中的獨特疾病名稱列表。

#----------異常貼文和病程紀錄----------

# 異常貼文
class AbnormalPost(models.Model):
    body_temperature = models.FloatField()
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    pet = models.ForeignKey('Pet', on_delete=models.CASCADE, related_name='abnormal_posts')
    updated_at = models.DateTimeField(auto_now=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='abnormal_posts')
    water_amount = models.IntegerField()
    weight = models.FloatField()

    def __str__(self):
        return f"AbnormalPost {self.id} for Pet {self.pet.pet_name}"

    #Removed 根據症狀ID列表為此異常記錄添加症狀關聯。

# 症狀
class Symptom(models.Model):
    symptom_name = models.CharField(max_length=100)

    def __str__(self):
        return self.symptom_name

# 病因
class Illness(models.Model):
    illness_name = models.CharField(max_length=100)

    def __str__(self):
        return self.illness_name

# 病程紀錄
class IllnessArchive(models.Model):
    archive_title = models.CharField(max_length=100)
    content = models.TextField()
    go_to_doctor = models.BooleanField(default=False)
    health_status = models.CharField(max_length=100)
    pet = models.ForeignKey('Pet', on_delete=models.CASCADE, related_name='illness_archives')
    popularity = models.IntegerField(default=0)
    post_date = models.DateField(default=date.today)
    updated_at = models.DateTimeField(auto_now=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='illness_archives')

    def __str__(self):
        return f"Archive: {self.archive_title} for {self.pet.pet_name}"

    #病程紀錄統計數據
    def get_interaction_stats(self):
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
        from interactions.models import UserInteraction
        
        archive_type = ContentType.objects.get_for_model(IllnessArchive)
        
        return UserInteraction.objects.filter(
            user=user,
            content_type=archive_type,
            object_id=self.id,
            relation=relation
        ).exists()

# 異常貼文的症狀(多對多關聯拆分)
class PostSymptomsRelation(models.Model):
    post = models.ForeignKey(AbnormalPost, on_delete=models.CASCADE, related_name='symptoms')
    symptom = models.ForeignKey(Symptom, on_delete=models.CASCADE, related_name='posts')

    class Meta:
        unique_together = ('post', 'symptom')

    def __str__(self):
        return f"Post {self.post.id} - Symptom {self.symptom.symptom_name}"

# 病程紀錄的異常貼文(多對多關聯拆分)
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

# 病程紀錄的病因(多對多關聯拆分)
class ArchiveIllnessRelation(models.Model):
    archive = models.ForeignKey(IllnessArchive, on_delete=models.CASCADE, related_name='illnesses')
    illness = models.ForeignKey(Illness, on_delete=models.CASCADE, related_name='archives')

    class Meta:
        unique_together = ('archive', 'illness')

    def __str__(self):
        return f"{self.archive.archive_title} - {self.illness.illness_name}"

#----------標註----------

# 在各種貼文中的寵物(多對多關聯拆分)
class PetGenericRelation(models.Model):
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    content_object = GenericForeignKey('content_type', 'object_id')
    object_id = models.PositiveIntegerField()
    pet = models.ForeignKey('Pet', on_delete=models.CASCADE, related_name='generic_relations')

    class Meta:
        unique_together = ('pet', 'content_type', 'object_id')

    def __str__(self):
        return f"Pet {self.pet.pet_name} in {self.content_type} {self.object_id}"