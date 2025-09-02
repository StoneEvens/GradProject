from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from decimal import Decimal
import uuid

User = get_user_model()


class Checkpoint(models.Model):
    """站點模型"""
    
    STATUS_CHOICES = [
        ('active', '啟用'),
        ('inactive', '停用'),
        ('maintenance', '維護中'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, verbose_name='站點名稱')
    description = models.TextField(blank=True, verbose_name='站點描述')
    
    # 地理位置
    latitude = models.DecimalField(
        max_digits=10, 
        decimal_places=8, 
        verbose_name='緯度',
        help_text='站點的緯度座標'
    )
    longitude = models.DecimalField(
        max_digits=11, 
        decimal_places=8, 
        verbose_name='經度',
        help_text='站點的經度座標'
    )
    radius = models.IntegerField(
        default=50,
        validators=[MinValueValidator(10), MaxValueValidator(200)],
        verbose_name='簽到範圍',
        help_text='簽到有效範圍（公尺）'
    )
    
    # 競標設定
    base_bid_price = models.IntegerField(
        default=100,
        validators=[MinValueValidator(1)],
        verbose_name='起標價',
        help_text='站點競標的基礎價格（金幣）'
    )
    
    # 統計資訊
    total_checkins = models.IntegerField(default=0, verbose_name='總簽到次數')
    popularity_score = models.FloatField(default=0.0, verbose_name='熱門度分數')
    
    # 狀態管理
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active',
        verbose_name='狀態'
    )
    
    # 時間戳記
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')
    
    class Meta:
        verbose_name = '站點'
        verbose_name_plural = '站點'
        ordering = ['-popularity_score', 'name']
        indexes = [
            models.Index(fields=['latitude', 'longitude']),
            models.Index(fields=['status']),
            models.Index(fields=['-popularity_score']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.latitude}, {self.longitude})"
    
    def update_popularity_score(self):
        """更新熱門度分數（基於最近的簽到次數）"""
        from datetime import timedelta
        recent_checkins = self.checkins.filter(
            timestamp__gte=timezone.now() - timedelta(days=30)
        ).count()
        
        # 計算熱門度分數（近30天簽到次數 + 總簽到次數權重）
        self.popularity_score = recent_checkins * 2 + self.total_checkins * 0.1
        self.save(update_fields=['popularity_score'])
        
    def is_within_range(self, user_lat, user_lng):
        """檢查使用者位置是否在簽到範圍內"""
        from geopy.distance import geodesic
        
        checkpoint_location = (float(self.latitude), float(self.longitude))
        user_location = (float(user_lat), float(user_lng))
        
        distance = geodesic(checkpoint_location, user_location).meters
        return distance <= self.radius


class Mission(models.Model):
    """任務模型"""
    
    TYPE_CHOICES = [
        ('daily', '每日任務'),
        ('route', '路線挑戰'),
        ('special', '特殊任務'),
    ]
    
    STATUS_CHOICES = [
        ('active', '進行中'),
        ('completed', '已完成'),
        ('expired', '已過期'),
        ('cancelled', '已取消'),
    ]
    
    DIFFICULTY_CHOICES = [
        ('easy', '簡單'),
        ('medium', '中等'),
        ('hard', '困難'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='interactivecity_missions', verbose_name='使用者')
    
    # 任務基本資訊
    title = models.CharField(max_length=100, verbose_name='任務標題')
    description = models.TextField(verbose_name='任務描述')
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, verbose_name='任務類型')
    difficulty = models.CharField(max_length=20, choices=DIFFICULTY_CHOICES, default='easy', verbose_name='難度')
    
    # 任務目標
    target_checkpoints = models.ManyToManyField(
        Checkpoint, 
        through='MissionCheckpoint',
        related_name='missions',
        verbose_name='目標站點'
    )
    required_checkins = models.IntegerField(verbose_name='需要簽到的站點數量')
    
    # 獎勵設定
    reward_coins = models.IntegerField(
        validators=[MinValueValidator(1)],
        verbose_name='金幣獎勵'
    )
    bonus_reward = models.IntegerField(default=0, verbose_name='額外獎勵')
    
    # 任務狀態
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active', verbose_name='狀態')
    progress = models.IntegerField(default=0, verbose_name='完成進度')
    
    # 時間管理
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    expires_at = models.DateTimeField(verbose_name='過期時間')
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name='完成時間')
    
    class Meta:
        verbose_name = '任務'
        verbose_name_plural = '任務'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['type', 'status']),
            models.Index(fields=['expires_at']),
        ]
    
    def __str__(self):
        return f"{self.title} - {self.user.username}"
    
    @property
    def is_expired(self):
        """檢查任務是否已過期"""
        return timezone.now() > self.expires_at
    
    @property
    def completion_percentage(self):
        """計算完成百分比"""
        if self.required_checkins == 0:
            return 0
        return min(100, (self.progress / self.required_checkins) * 100)
    
    def mark_completed(self):
        """標記任務完成"""
        if self.status == 'active' and self.progress >= self.required_checkins:
            self.status = 'completed'
            self.completed_at = timezone.now()
            self.save(update_fields=['status', 'completed_at'])
            
            # 發放金幣獎勵
            CoinTransaction.objects.create(
                user=self.user,
                type='earn',
                amount=self.reward_coins + self.bonus_reward,
                reason=f'完成任務：{self.title}',
                reference_type='mission',
                reference_id=str(self.id)
            )
            return True
        return False


class MissionCheckpoint(models.Model):
    """任務站點關聯模型（中間表）"""
    
    mission = models.ForeignKey(Mission, on_delete=models.CASCADE, verbose_name='任務')
    checkpoint = models.ForeignKey(Checkpoint, on_delete=models.CASCADE, verbose_name='站點')
    order = models.PositiveIntegerField(default=0, verbose_name='順序')
    is_completed = models.BooleanField(default=False, verbose_name='是否已完成')
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name='完成時間')
    
    class Meta:
        verbose_name = '任務站點'
        verbose_name_plural = '任務站點'
        unique_together = ['mission', 'checkpoint']
        ordering = ['order']
    
    def __str__(self):
        return f"{self.mission.title} - {self.checkpoint.name}"


class CheckIn(models.Model):
    """簽到記錄模型"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='checkins', verbose_name='使用者')
    checkpoint = models.ForeignKey(Checkpoint, on_delete=models.CASCADE, related_name='checkins', verbose_name='站點')
    mission = models.ForeignKey(
        Mission, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='checkins',
        verbose_name='相關任務'
    )
    
    # 位置驗證資訊
    user_latitude = models.DecimalField(max_digits=10, decimal_places=8, verbose_name='使用者緯度')
    user_longitude = models.DecimalField(max_digits=11, decimal_places=8, verbose_name='使用者經度')
    location_accuracy = models.FloatField(verbose_name='定位精確度（公尺）')
    distance_to_checkpoint = models.FloatField(verbose_name='到站點的距離（公尺）')
    
    # 簽到資訊
    timestamp = models.DateTimeField(auto_now_add=True, verbose_name='簽到時間')
    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name='IP位址')
    user_agent = models.TextField(blank=True, verbose_name='用戶代理')
    
    # 驗證狀態
    is_valid = models.BooleanField(default=True, verbose_name='是否有效')
    validation_notes = models.TextField(blank=True, verbose_name='驗證備註')
    
    class Meta:
        verbose_name = '簽到記錄'
        verbose_name_plural = '簽到記錄'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', '-timestamp']),
            models.Index(fields=['checkpoint', '-timestamp']),
            models.Index(fields=['mission']),
        ]
    
    def __str__(self):
        return f"{self.user.username} @ {self.checkpoint.name} - {self.timestamp.strftime('%Y-%m-%d %H:%M')}"
    
    def save(self, *args, **kwargs):
        # 計算到站點的距離
        if not self.distance_to_checkpoint:
            from geopy.distance import geodesic
            user_location = (float(self.user_latitude), float(self.user_longitude))
            checkpoint_location = (float(self.checkpoint.latitude), float(self.checkpoint.longitude))
            self.distance_to_checkpoint = geodesic(user_location, checkpoint_location).meters
        
        # 驗證簽到是否在有效範圍內
        if self.distance_to_checkpoint > self.checkpoint.radius:
            self.is_valid = False
            self.validation_notes = f"距離站點 {self.distance_to_checkpoint:.1f} 公尺，超出有效範圍 {self.checkpoint.radius} 公尺"
        
        super().save(*args, **kwargs)
        
        # 更新站點統計
        if self.is_valid:
            self.checkpoint.total_checkins += 1
            self.checkpoint.save(update_fields=['total_checkins'])
            self.checkpoint.update_popularity_score()
            
            # 更新任務進度
            if self.mission:
                mission_checkpoint = MissionCheckpoint.objects.filter(
                    mission=self.mission,
                    checkpoint=self.checkpoint
                ).first()
                
                if mission_checkpoint and not mission_checkpoint.is_completed:
                    mission_checkpoint.is_completed = True
                    mission_checkpoint.completed_at = self.timestamp
                    mission_checkpoint.save()
                    
                    # 更新任務進度
                    self.mission.progress = MissionCheckpoint.objects.filter(
                        mission=self.mission,
                        is_completed=True
                    ).count()
                    self.mission.save(update_fields=['progress'])
                    
                    # 檢查是否完成任務
                    self.mission.mark_completed()


class CoinTransaction(models.Model):
    """金幣交易模型"""
    
    TYPE_CHOICES = [
        ('earn', '獲得'),
        ('spend', '消費'),
        ('refund', '退款'),
        ('bonus', '獎勵'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='coin_transactions', verbose_name='使用者')
    
    # 交易資訊
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, verbose_name='交易類型')
    amount = models.IntegerField(validators=[MinValueValidator(1)], verbose_name='金額')
    balance_before = models.IntegerField(verbose_name='交易前餘額')
    balance_after = models.IntegerField(verbose_name='交易後餘額')
    
    # 交易原因
    reason = models.CharField(max_length=200, verbose_name='交易原因')
    reference_type = models.CharField(max_length=50, blank=True, verbose_name='關聯類型')
    reference_id = models.CharField(max_length=100, blank=True, verbose_name='關聯ID')
    
    # 時間戳記
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='交易時間')
    
    class Meta:
        verbose_name = '金幣交易'
        verbose_name_plural = '金幣交易'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['type']),
            models.Index(fields=['reference_type', 'reference_id']),
        ]
    
    def __str__(self):
        type_display = dict(self.TYPE_CHOICES)[self.type]
        return f"{self.user.username} {type_display} {self.amount} 金幣 - {self.reason}"
    
    def save(self, *args, **kwargs):
        # 計算交易前後餘額
        if not self.balance_before:
            user_profile, created = UserCoinBalance.objects.get_or_create(user=self.user)
            self.balance_before = user_profile.balance
            
            if self.type in ['earn', 'refund', 'bonus']:
                self.balance_after = self.balance_before + self.amount
            else:  # spend
                self.balance_after = self.balance_before - self.amount
        
        super().save(*args, **kwargs)
        
        # 更新使用者金幣餘額
        user_profile, created = UserCoinBalance.objects.get_or_create(user=self.user)
        user_profile.balance = self.balance_after
        user_profile.save()


class UserCoinBalance(models.Model):
    """使用者金幣餘額模型"""
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='coin_balance', verbose_name='使用者')
    balance = models.IntegerField(default=0, validators=[MinValueValidator(0)], verbose_name='餘額')
    total_earned = models.IntegerField(default=0, verbose_name='累計獲得')
    total_spent = models.IntegerField(default=0, verbose_name='累計消費')
    last_updated = models.DateTimeField(auto_now=True, verbose_name='最後更新時間')
    
    class Meta:
        verbose_name = '使用者金幣餘額'
        verbose_name_plural = '使用者金幣餘額'
    
    def __str__(self):
        return f"{self.user.username} - {self.balance} 金幣"
    
    @classmethod
    def get_balance(cls, user):
        """獲取使用者餘額"""
        balance, created = cls.objects.get_or_create(user=user)
        return balance.balance
    
    @classmethod
    def can_spend(cls, user, amount):
        """檢查使用者是否有足夠餘額"""
        return cls.get_balance(user) >= amount


class Auction(models.Model):
    """競標模型"""
    
    STATUS_CHOICES = [
        ('pending', '待開始'),
        ('active', '進行中'),
        ('ended', '已結束'),
        ('cancelled', '已取消'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    checkpoint = models.ForeignKey(Checkpoint, on_delete=models.CASCADE, related_name='auctions', verbose_name='站點')
    
    # 競標資訊
    title = models.CharField(max_length=100, verbose_name='競標標題')
    description = models.TextField(blank=True, verbose_name='競標描述')
    min_bid = models.IntegerField(validators=[MinValueValidator(1)], verbose_name='最低出價')
    current_bid = models.IntegerField(default=0, verbose_name='當前最高出價')
    current_bidder = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='current_bids',
        verbose_name='當前最高出價者'
    )
    
    # 競標時間
    start_date = models.DateTimeField(verbose_name='開始時間')
    end_date = models.DateTimeField(verbose_name='結束時間')
    
    # 展示權設定
    display_duration_days = models.IntegerField(default=7, verbose_name='展示期限（天）')
    
    # 狀態管理
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='狀態')
    winner = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='won_auctions',
        verbose_name='得標者'
    )
    
    # 時間戳記
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')
    
    class Meta:
        verbose_name = '競標'
        verbose_name_plural = '競標'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['checkpoint', 'status']),
            models.Index(fields=['end_date']),
            models.Index(fields=['winner']),
        ]
    
    def __str__(self):
        return f"{self.checkpoint.name} 競標 - {self.get_status_display()}"
    
    @property
    def is_active(self):
        """檢查競標是否進行中"""
        now = timezone.now()
        return (
            self.status == 'active' and 
            self.start_date <= now <= self.end_date
        )
    
    def place_bid(self, user, amount):
        """出價"""
        if not self.is_active:
            return False, "競標未進行中"
        
        if amount <= self.current_bid:
            return False, "出價必須高於當前最高出價"
        
        if amount < self.min_bid:
            return False, f"出價不能低於最低出價 {self.min_bid}"
        
        if not UserCoinBalance.can_spend(user, amount):
            return False, "金幣餘額不足"
        
        # 退還前一個出價者的金幣
        if self.current_bidder:
            CoinTransaction.objects.create(
                user=self.current_bidder,
                type='refund',
                amount=self.current_bid,
                reason=f'競標被超越退款：{self.checkpoint.name}',
                reference_type='auction',
                reference_id=str(self.id)
            )
        
        # 記錄新的出價
        AuctionBid.objects.create(
            auction=self,
            bidder=user,
            amount=amount
        )
        
        # 凍結新出價者的金幣
        CoinTransaction.objects.create(
            user=user,
            type='spend',
            amount=amount,
            reason=f'競標出價：{self.checkpoint.name}',
            reference_type='auction',
            reference_id=str(self.id)
        )
        
        # 更新競標資訊
        self.current_bid = amount
        self.current_bidder = user
        self.save(update_fields=['current_bid', 'current_bidder'])
        
        return True, "出價成功"
    
    def end_auction(self):
        """結束競標"""
        if self.status != 'active':
            return False, "競標狀態不正確"
        
        self.status = 'ended'
        if self.current_bidder:
            self.winner = self.current_bidder
            
            # 創建展示權記錄
            from datetime import timedelta
            DisplayRight.objects.create(
                checkpoint=self.checkpoint,
                user=self.winner,
                start_date=timezone.now(),
                end_date=timezone.now() + timedelta(days=self.display_duration_days),
                acquired_through='auction',
                auction=self
            )
        
        self.save(update_fields=['status', 'winner'])
        return True, "競標結束"


class AuctionBid(models.Model):
    """競標出價記錄模型"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    auction = models.ForeignKey(Auction, on_delete=models.CASCADE, related_name='bids', verbose_name='競標')
    bidder = models.ForeignKey(User, on_delete=models.CASCADE, related_name='auction_bids', verbose_name='出價者')
    amount = models.IntegerField(validators=[MinValueValidator(1)], verbose_name='出價金額')
    timestamp = models.DateTimeField(auto_now_add=True, verbose_name='出價時間')
    
    class Meta:
        verbose_name = '競標出價記錄'
        verbose_name_plural = '競標出價記錄'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['auction', '-timestamp']),
            models.Index(fields=['bidder', '-timestamp']),
        ]
    
    def __str__(self):
        return f"{self.bidder.username} 出價 {self.amount} @ {self.auction.checkpoint.name}"


class DisplayRight(models.Model):
    """展示權模型"""
    
    ACQUIRED_CHOICES = [
        ('auction', '競標獲得'),
        ('special', '特殊活動'),
        ('admin', '管理員授予'),
    ]
    
    STATUS_CHOICES = [
        ('active', '使用中'),
        ('expired', '已過期'),
        ('cancelled', '已取消'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    checkpoint = models.ForeignKey(Checkpoint, on_delete=models.CASCADE, related_name='display_rights', verbose_name='站點')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='display_rights', verbose_name='使用者')
    auction = models.ForeignKey(
        Auction, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='display_rights',
        verbose_name='相關競標'
    )
    
    # 展示期間
    start_date = models.DateTimeField(verbose_name='開始時間')
    end_date = models.DateTimeField(verbose_name='結束時間')
    
    # 獲得方式
    acquired_through = models.CharField(max_length=20, choices=ACQUIRED_CHOICES, verbose_name='獲得方式')
    
    # 狀態管理
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active', verbose_name='狀態')
    
    # 時間戳記
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')
    
    class Meta:
        verbose_name = '展示權'
        verbose_name_plural = '展示權'
        ordering = ['-start_date']
        indexes = [
            models.Index(fields=['checkpoint', 'status']),
            models.Index(fields=['user', 'status']),
            models.Index(fields=['start_date', 'end_date']),
        ]
        # 確保同一站點在同一時間只能有一個有效展示權
        constraints = [
            models.UniqueConstraint(
                fields=['checkpoint'],
                condition=models.Q(status='active'),
                name='unique_active_display_right_per_checkpoint'
            )
        ]
    
    def __str__(self):
        return f"{self.user.username} @ {self.checkpoint.name} ({self.start_date.date()} - {self.end_date.date()})"
    
    @property
    def is_active(self):
        """檢查展示權是否有效"""
        now = timezone.now()
        return (
            self.status == 'active' and 
            self.start_date <= now <= self.end_date
        )
    
    @property
    def days_remaining(self):
        """剩餘天數"""
        if not self.is_active:
            return 0
        remaining = self.end_date - timezone.now()
        return max(0, remaining.days)
    
    def save(self, *args, **kwargs):
        # 自動更新過期狀態
        if self.status == 'active' and timezone.now() > self.end_date:
            self.status = 'expired'
        
        super().save(*args, **kwargs)


# 為了保持與現有代碼的兼容性，添加一些輔助方法
class InteractiveCityManager:
    """互動城市管理器，提供便利方法"""
    
    @staticmethod
    def create_daily_missions(user, date=None):
        """為使用者創建每日任務"""
        from datetime import timedelta
        import random
        
        if date is None:
            date = timezone.now().date()
        
        # 檢查是否已有今日任務
        existing_missions = Mission.objects.filter(
            user=user,
            type='daily',
            created_at__date=date
        )
        
        if existing_missions.exists():
            return existing_missions
        
        # 獲取可用站點
        available_checkpoints = list(Checkpoint.objects.filter(status='active'))
        if len(available_checkpoints) < 2:
            return []
        
        missions = []
        mission_configs = [
            {'difficulty': 'easy', 'count': 2, 'reward': 10, 'title': '輕鬆散步'},
            {'difficulty': 'medium', 'count': 4, 'reward': 25, 'title': '活力漫步'},
            {'difficulty': 'hard', 'count': 6, 'reward': 50, 'title': '挑戰極限'},
        ]
        
        expires_at = timezone.now().replace(hour=23, minute=59, second=59) + timedelta(days=1)
        
        for config in mission_configs:
            if len(available_checkpoints) >= config['count']:
                selected_checkpoints = random.sample(available_checkpoints, config['count'])
                
                mission = Mission.objects.create(
                    user=user,
                    title=config['title'],
                    description=f"經過 {config['count']} 個站點完成今日散步",
                    type='daily',
                    difficulty=config['difficulty'],
                    required_checkins=config['count'],
                    reward_coins=config['reward'],
                    expires_at=expires_at
                )
                
                # 添加目標站點
                for i, checkpoint in enumerate(selected_checkpoints):
                    MissionCheckpoint.objects.create(
                        mission=mission,
                        checkpoint=checkpoint,
                        order=i + 1
                    )
                
                missions.append(mission)
        
        return missions
    
    @staticmethod
    def get_user_coin_balance(user):
        """獲取使用者金幣餘額"""
        return UserCoinBalance.get_balance(user)
    
    @staticmethod
    def get_nearby_checkpoints(lat, lng, radius=1000):
        """獲取附近的站點"""
        from geopy.distance import geodesic
        
        checkpoints = Checkpoint.objects.filter(status='active')
        nearby = []
        
        user_location = (float(lat), float(lng))
        
        for checkpoint in checkpoints:
            checkpoint_location = (float(checkpoint.latitude), float(checkpoint.longitude))
            distance = geodesic(user_location, checkpoint_location).meters
            
            if distance <= radius:
                checkpoint.distance = distance
                nearby.append(checkpoint)
        
        return sorted(nearby, key=lambda x: x.distance)