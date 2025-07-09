from django.db import models
from django.conf import settings
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from pets.models import Pet

User = get_user_model()

# === 飼料資訊 ===
class Feed(models.Model):
    # 處理狀態選項
    PROCESSING_STATUS_CHOICES = [
        ('pending', '待處理'),
        ('processing', '處理中'),
        ('completed', '處理完成'),
        ('completed_with_warnings', '處理完成但有警告'),
        ('failed', '處理失敗'),
    ]
    
    feed_name = models.CharField(max_length=100)
    protein = models.FloatField(help_text="蛋白質 (g/100g)", default=0)
    fat = models.FloatField(help_text="脂肪 (g/100g)", default=0)
    calcium = models.FloatField(help_text="鈣 (g/100g)", default=0)
    phosphorus = models.FloatField(help_text="磷 (g/100g)", default=0)
    magnesium = models.FloatField(help_text="鎂 (mg/100g)", default=0)
    sodium = models.FloatField(help_text="鈉 (mg/100g)", default=0)
    carbohydrate = models.FloatField(help_text="碳水化合物 (g/100g)", default=0)  # 計算ME會用到
    extracted_text = models.TextField(blank=True, null=True, help_text="OCR 提取的原始文本")
    processing_status = models.CharField(
        '處理狀態', 
        max_length=25, 
        choices=PROCESSING_STATUS_CHOICES,
        default='pending'
    )
    processing_error = models.TextField('處理錯誤信息', blank=True)
    popularity = models.IntegerField(default=0, help_text="熱度，主要由點讚數決定")
    created_at = models.DateTimeField('創建時間', auto_now_add=True)
    updated_at = models.DateTimeField('更新時間', auto_now=True)

    def __str__(self):
        return self.feed_name

    def is_ready_for_calculation(self):
        """檢查飼料狀態和營養數據完整性，判斷是否可用於計算。"""
        if self.processing_status in ['pending', 'processing']:
            return False, "飼料營養信息正在處理中，請稍後再試。", None
        if self.processing_status == 'failed':
            return False, f"飼料營養信息處理失敗，原因: {self.processing_error or '未知錯誤'}。請嘗試重新上傳或修正。", 'failed'
        
        required_nutrients = {'protein': '蛋白質', 'fat': '脂肪', 'carbohydrate': '碳水化合物'}
        missing_nutrients_details = []
        for nutrient_key, nutrient_name in required_nutrients.items():
            value = getattr(self, nutrient_key, None)
            if value is None or value == 0: # 假設0也視為缺失或不足以計算
                missing_nutrients_details.append(nutrient_name)
        
        if missing_nutrients_details:
            return False, f"飼料營養數據不完整 (缺少: {', '.join(missing_nutrients_details)})，無法進行準確計算。", 'incomplete_data'
        return True, "飼料數據完整，可以計算。", 'ready'

    def get_energy_per_100g(self):
        """根據飼料的PFC計算每100克飼料的代謝能量 (ME, kcal)。使用修菲公式。"""
        # ME (kcal/100g) = (粗蛋白 % x 4) + (粗脂肪 % x 9) + (碳水化合物 % x 4)
        # 注意: 有些資料來源對蛋白質和碳水化合物使用3.5kcal/g，脂肪使用8.5kcal/g。
        # 這裡採用更常見的 4, 9, 4 估算值。
        if self.protein is not None and self.fat is not None and self.carbohydrate is not None and \
           self.protein > 0 and self.fat > 0 and self.carbohydrate > 0:
            # 確保數值是存在的，避免 NoneType 錯誤
            protein_kcal = (self.protein or 0) * 4
            fat_kcal = (self.fat or 0) * 9
            carb_kcal = (self.carbohydrate or 0) * 4
            return protein_kcal + fat_kcal + carb_kcal
        return 0 # 或拋出錯誤，表示數據不足無法計算

    def handle_interaction(self, user, relation, allowed_relations):
        """處理用戶對此飼料的互動，並更新熱度。"""
        from interactions.models import UserInteraction # 延遲導入
        from django.contrib.contenttypes.models import ContentType
        from rest_framework import status as drf_status # 引入 drf_status

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
            action_taken_message = f"已取消對飼料 '{self.feed_name}' 的 {relation}"
            if relation == 'upvoted': # 假設 popularity 主要受 upvoted 影響
                self.popularity = max(0, self.popularity - 1)
                popularity_changed = True
            # 如果 downvoted 也影響 popularity，在此處添加邏輯
            elif relation == 'downvoted':
                self.popularity +=1 # 移除倒讚，熱度可能增加
                popularity_changed = True

        else: # 新增互動
            status_code = drf_status.HTTP_201_CREATED
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
                    if opposite_relation == 'downvoted' and relation == 'upvoted':
                        self.popularity +=1 # 抵銷之前踩的影響
                        popularity_changed = True
                    elif opposite_relation == 'upvoted' and relation == 'downvoted':
                        self.popularity = max(0, self.popularity - 1) # 抵銷之前讚的影響
                        popularity_changed = True
            
            UserInteraction.objects.create(
                user=user,
                content_type=content_type,
                object_id=self.id,
                relation=relation
            )
            action_taken_message = f"已成功對飼料 '{self.feed_name}' {relation}"
            if relation == 'upvoted':
                self.popularity += 1
                popularity_changed = True
            elif relation == 'downvoted':
                self.popularity = max(0, self.popularity - 1)
                popularity_changed = True
        
        if popularity_changed:
            self.save(update_fields=['popularity'])
        
        return True, action_taken_message, status_code

    class Meta:
        verbose_name = '飼料'
        verbose_name_plural = '飼料'
        ordering = ['-created_at']
    
    def get_interaction_stats(self):
        """
        獲取飼料/疾病檔案的互動統計
        """
        from interactions.models import UserInteraction
        
        feed_type = ContentType.objects.get_for_model(Feed)
        
        upvotes = UserInteraction.objects.filter(
            content_type=feed_type,
            object_id=self.id,
            relation='upvoted'
        ).count()
        
        downvotes = UserInteraction.objects.filter(
            content_type=feed_type,
            object_id=self.id,
            relation='downvoted'
        ).count()
        
        saves = UserInteraction.objects.filter(
            content_type=feed_type,
            object_id=self.id,
            relation='saved'
        ).count()
        
        shares = UserInteraction.objects.filter(
            content_type=feed_type,
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
        檢查用戶是否對飼料/疾病檔案有特定互動
        """
        if not user or not user.is_authenticated:
            return False
            
        from interactions.models import UserInteraction
        
        feed_type = ContentType.objects.get_for_model(Feed)
        return UserInteraction.objects.filter(
            user=user,
            content_type=feed_type,
            object_id=self.id,
            relation=relation
        ).exists()

# === 使用者飼料使用紀錄 ===
class UserFeed(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='feeds',
        verbose_name='用戶',
        null=True
    )
    feed = models.ForeignKey(
        Feed,
        on_delete=models.CASCADE,
        related_name='users',
        verbose_name='飼料',
        null=True
    )
    last_used = models.DateTimeField('最近使用時間', default=timezone.now)

    def __str__(self):
        return f"{self.user.username} - {self.feed.feed_name}"

    class Meta:
        verbose_name = '用戶飼料'
        verbose_name_plural = '用戶飼料'
        unique_together = ['user', 'feed']
        ordering = ['-last_used']

# === 寵物飼料使用紀錄 ===
class PetFeed(models.Model):
    pet = models.ForeignKey(
        Pet,
        on_delete=models.CASCADE,
        related_name='pet_feeds',
        verbose_name='寵物',
        null=True
    )
    feed = models.ForeignKey(
        Feed,
        on_delete=models.CASCADE,
        related_name='pet_users',
        verbose_name='飼料'
    )
    last_used = models.DateTimeField('最近使用時間', default=timezone.now)
    is_current = models.BooleanField('是否為目前使用中', default=True)
    notes = models.TextField('備註', blank=True, null=True)
    
    def __str__(self):
        return f"{self.pet.pet_name} - {self.feed.feed_name}"
    
    def save(self, *args, **kwargs):
        # 如果此記錄被標記為當前使用中，則將同一寵物的其他記錄設為非當前使用
        if self.is_current:
            PetFeed.objects.filter(pet=self.pet, is_current=True).exclude(id=self.id).update(is_current=False)
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = '寵物飼料'
        verbose_name_plural = '寵物飼料'
        unique_together = ['pet', 'feed']
        ordering = ['-last_used']

