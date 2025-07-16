from datetime import date
from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from rest_framework import status as drf_status
from django.contrib.auth import get_user_model

from accounts.models import CustomUser
User = get_user_model()

#----------寵物本身----------

class Pet(models.Model):
    PET_STAGE_CHOICES = [('puppy', '幼犬'), ('adult', '成犬/成貓'), ('pregnant', '懷孕期'), ('lactating', '哺乳期'), ('kitten', '幼貓'),]

    age = models.IntegerField(null=True, blank=True, help_text="年齡 (歲)")
    breed = models.CharField(max_length=100, null=True, blank=True, help_text="品種")
    height = models.FloatField(null=True, blank=True, help_text="身高 (公分)")
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='pets', null=True)
    is_dog = models.BooleanField(default=False)
    pet_name = models.CharField(max_length=100)
    pet_stage = models.CharField(max_length=20, choices=PET_STAGE_CHOICES, null=True, blank=True, help_text="年齡階段")
    pet_type = models.CharField(max_length=100)  
    predicted_adult_weight = models.FloatField(null=True, blank=True, help_text="預期成犬/成貓體重 (公斤)")
    weight = models.FloatField(null=True, blank=True, help_text="體重 (公斤)")
    description = models.TextField(blank=True, null=True, help_text="寵物描述")

    def __str__(self):
        return f"{self.pet_name} ({self.pet_type})"
    
    def get_pet(pet_id:str):
        return Pet.objects.filter(
            id=pet_id
        )
    
    def get_pet(user: User):
        return Pet.objects.filter(owner=user)
    
    def create(owner, weight, pet_stage, age=None, pet_name=None, breed=None, pet_type=None, predicted_adult_weight=None):
        Pet.create(
            owner=owner,
            weight=weight,
            pet_stage=pet_stage,
            age=age,
            pet_name=pet_name,
            breed=breed,
            pet_type=pet_type,
            predicted_adult_weight=predicted_adult_weight
        )

    def update(self, owner=None, weight=None, pet_stage=None, age=None, pet_name=None, breed=None, pet_type=None, predicted_adult_weight=None, description=None):
        update_fields = []

        if owner:
            self.owner = owner
            update_fields.append("owner")
        
        if weight:
            self.weight = weight
            update_fields.append("weight")
        
        if pet_stage:
            self.pet_stage = pet_stage
            update_fields.append("pet_stage")
        
        if age:
            self.age = age
            update_fields.append("age")
        
        if pet_name:
            self.pet_name = pet_name
            update_fields.append("pet_name")

        if breed:
            self.breed = breed
            update_fields.append("breed")
        
        if pet_type:
            self.pet_type = pet_type
            update_fields.append("pet_type")
        
        if predicted_adult_weight:
            self.predicted_adult_weight = predicted_adult_weight
            update_fields.append("predicted_adult_weight")
        
        if description is not None:
            self.description = description
            update_fields.append("description")

        self.save(update_fields=update_fields)

    #Removed 獲取此寵物所有病程記錄中的獨特疾病名稱列表。

#----------異常貼文和病程紀錄----------

# 異常貼文
class AbnormalPost(models.Model):
    body_temperature = models.FloatField()
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    pet = models.ForeignKey('Pet', on_delete=models.CASCADE, related_name='abnormal_posts', null=True)
    updated_at = models.DateTimeField(auto_now=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='abnormal_posts', null=True)
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
class ForumContent(models.Model):
    archive_title = models.CharField(max_length=100)
    content = models.TextField()
    go_to_doctor = models.BooleanField(default=False)
    health_status = models.CharField(max_length=100)
    pet = models.ForeignKey('Pet', on_delete=models.CASCADE, related_name='illness_archives', null=True)
    postFrame = models.ForeignKey(
        'social.PostFrame', on_delete=models.CASCADE, related_name='illness_archives_postFrame', null=True
    )

    def __str__(self):
        return f"Archive: {self.archive_title} for {self.pet.pet_name}"
    
    def get_content(user: CustomUser = None, hashtag: str = None, query: str = None, pets: list[Pet] = None):
        if user:
            return ForumContent.objects.filter(postFrame__user=user).order_by('-post_date')[:50]
        
        if hashtag:
            return ForumContent.objects.filter(content__icontains=query)[:50]
        
        if query:
            return ForumContent.objects.filter(content__icontains=query)[:50]
        
        if pets:
            return ForumContent.objects.filter(pet__in=pets).order_by('-postFrame__post_date')
        
        return ForumContent.objects.none()

# 異常貼文的症狀(多對多關聯拆分)
class PostSymptomsRelation(models.Model):
    post = models.ForeignKey(AbnormalPost, on_delete=models.CASCADE, related_name='symptoms', null=True)
    symptom = models.ForeignKey(Symptom, on_delete=models.CASCADE, related_name='posts', null=True)

    class Meta:
        unique_together = ('post', 'symptom')

    def __str__(self):
        return f"Post {self.post.id} - Symptom {self.symptom.symptom_name}"

# 病程紀錄的異常貼文(多對多關聯拆分)
class ArchiveAbnormalPostRelation(models.Model):
    archive = models.ForeignKey(
        ForumContent,
        on_delete=models.CASCADE,
        related_name='abnormal_posts',
        null=True
    )
    post = models.ForeignKey(
        AbnormalPost,
        on_delete=models.CASCADE,
        related_name='archive_links',
        null=True
    )

    class Meta:
        unique_together = ('archive', 'post')

    def __str__(self):
        return f"Archive {self.archive.id} linked to AbnormalPost {self.post.id}"

# 病程紀錄的病因(多對多關聯拆分)
class ArchiveIllnessRelation(models.Model):
    archive = models.ForeignKey(ForumContent, on_delete=models.CASCADE, related_name='illnesses', null=True)
    illness = models.ForeignKey(Illness, on_delete=models.CASCADE, related_name='archives')

    class Meta:
        unique_together = ('archive', 'illness')

    def __str__(self):
        return f"{self.archive.archive_title} - {self.illness.illness_name}"
    
    def get_illnesses(archives: list[ForumContent]):
        return ArchiveIllnessRelation.objects.filter(archive__in=archives).values_list('illness__illness_name', flat=True)