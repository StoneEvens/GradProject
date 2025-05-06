from datetime import date
from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

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

