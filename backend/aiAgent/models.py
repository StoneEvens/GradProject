"""
AI Agent Models
對話記錄資料模型
"""

from django.db import models
from django.conf import settings


class Conversation(models.Model):
    """對話會話模型"""

    # 基本資訊
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ai_conversations',
        verbose_name='使用者'
    )
    title = models.CharField(
        max_length=200,
        verbose_name='對話標題',
        help_text='自動從第一條訊息生成或使用者自訂'
    )

    # 時間戳記
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')
    last_message_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='最後訊息時間'
    )

    # 統計資訊
    message_count = models.IntegerField(default=0, verbose_name='訊息數量')

    # 狀態
    is_pinned = models.BooleanField(default=False, verbose_name='置頂')
    is_archived = models.BooleanField(default=False, verbose_name='已封存')

    # Metadata
    context_data = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='對話上下文',
        help_text='儲存寵物ID、位置等上下文資訊'
    )

    class Meta:
        db_table = 'ai_conversations'
        verbose_name = 'AI 對話'
        verbose_name_plural = 'AI 對話'
        ordering = ['-last_message_at', '-updated_at']
        indexes = [
            models.Index(fields=['user', '-last_message_at']),
            models.Index(fields=['user', 'is_archived']),
        ]

    def __str__(self):
        return f"{self.user.user_account} - {self.title}"

    def update_message_count(self):
        """更新訊息數量"""
        self.message_count = self.messages.count()
        self.save(update_fields=['message_count'])

    def update_last_message_time(self):
        """更新最後訊息時間"""
        last_message = self.messages.order_by('-created_at').first()
        if last_message:
            self.last_message_at = last_message.created_at
            self.save(update_fields=['last_message_at'])


class Message(models.Model):
    """對話訊息模型"""

    # 訊息角色
    ROLE_USER = 'user'
    ROLE_ASSISTANT = 'assistant'
    ROLE_SYSTEM = 'system'

    ROLE_CHOICES = [
        (ROLE_USER, '使用者'),
        (ROLE_ASSISTANT, 'AI 助理'),
        (ROLE_SYSTEM, '系統'),
    ]

    # 關聯
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name='messages',
        verbose_name='對話'
    )

    # 訊息內容
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        verbose_name='角色'
    )
    content = models.TextField(verbose_name='訊息內容')

    # 時間戳記
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')

    # AI 回應相關資訊（僅 role=assistant 時使用）
    intent = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        verbose_name='識別的意圖'
    )
    confidence = models.FloatField(
        null=True,
        blank=True,
        verbose_name='信心度'
    )
    source = models.CharField(
        max_length=50,
        default='ai_agent',
        verbose_name='回應來源'
    )

    # UI 控制標記
    has_tutorial = models.BooleanField(default=False, verbose_name='包含教學')
    tutorial_type = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        verbose_name='教學類型'
    )
    has_recommended_users = models.BooleanField(default=False, verbose_name='包含推薦用戶')
    has_recommended_articles = models.BooleanField(default=False, verbose_name='包含推薦文章')
    has_calculator = models.BooleanField(default=False, verbose_name='包含計算機')
    has_operation = models.BooleanField(default=False, verbose_name='包含操作')
    operation_type = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        verbose_name='操作類型'
    )

    # 附加資料（JSON 格式）
    additional_data = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='附加資料',
        help_text='推薦的用戶ID、文章ID、貼文詳情等'
    )

    # 實體資訊
    entities = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='提取的實體',
        help_text='寵物品種、症狀、時間範圍等'
    )

    class Meta:
        db_table = 'ai_messages'
        verbose_name = 'AI 訊息'
        verbose_name_plural = 'AI 訊息'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['conversation', 'created_at']),
            models.Index(fields=['role']),
        ]

    def __str__(self):
        return f"{self.get_role_display()} - {self.content[:50]}"

    def save(self, *args, **kwargs):
        """儲存時更新對話的統計資訊"""
        is_new = self.pk is None
        super().save(*args, **kwargs)

        if is_new:
            # 更新對話的訊息數量和最後訊息時間
            self.conversation.update_message_count()
            self.conversation.update_last_message_time()

            # 如果是第一條訊息且對話標題為空，自動生成標題
            if self.conversation.message_count == 1 and not self.conversation.title:
                self.conversation.title = self._generate_title()
                self.conversation.save(update_fields=['title'])

    def _generate_title(self):
        """從訊息內容生成對話標題"""
        # 取前 50 個字元作為標題
        content = self.content.strip()
        if len(content) > 50:
            return content[:47] + '...'
        return content if content else '新對話'


class ConversationFeedback(models.Model):
    """對話回饋模型（用於改進 AI）"""

    RATING_VERY_POOR = 1
    RATING_POOR = 2
    RATING_FAIR = 3
    RATING_GOOD = 4
    RATING_EXCELLENT = 5

    RATING_CHOICES = [
        (RATING_VERY_POOR, '非常不滿意'),
        (RATING_POOR, '不滿意'),
        (RATING_FAIR, '普通'),
        (RATING_GOOD, '滿意'),
        (RATING_EXCELLENT, '非常滿意'),
    ]

    # 關聯
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name='feedbacks',
        verbose_name='訊息'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ai_feedbacks',
        verbose_name='使用者'
    )

    # 評分
    rating = models.IntegerField(
        choices=RATING_CHOICES,
        verbose_name='評分'
    )

    # 詳細回饋
    comment = models.TextField(
        blank=True,
        verbose_name='評論',
        help_text='使用者的詳細回饋'
    )

    # 問題類型
    is_inaccurate = models.BooleanField(default=False, verbose_name='回答不準確')
    is_unhelpful = models.BooleanField(default=False, verbose_name='沒有幫助')
    is_inappropriate = models.BooleanField(default=False, verbose_name='不適當')
    is_other = models.BooleanField(default=False, verbose_name='其他問題')

    # 時間戳記
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')

    class Meta:
        db_table = 'ai_conversation_feedbacks'
        verbose_name = 'AI 對話回饋'
        verbose_name_plural = 'AI 對話回饋'
        ordering = ['-created_at']
        unique_together = [['message', 'user']]  # 每個使用者對每條訊息只能回饋一次

    def __str__(self):
        return f"{self.user.user_account} - {self.get_rating_display()}"