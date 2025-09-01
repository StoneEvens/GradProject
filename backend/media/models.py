from django.db import models
from gradProject import settings
from pets.models import Pet
from social.models import PostFrame
from accounts.models import CustomUser

from utils.firebase_service import cleanup_old_headshot
import logging

logger = logging.getLogger(__name__)

class SuperImage(models.Model):
    #Storage Details
    firebase_url = models.URLField(max_length=500, help_text="Firebase Storage 圖片 URL", blank=True, null=True)
    firebase_path = models.CharField(max_length=255, help_text="Firebase Storage 檔案路徑", blank=True, null=True)
    
    #Image Details
    original_filename = models.CharField(max_length=255, blank=True, null=True)
    file_size = models.PositiveIntegerField(blank=True, null=True, help_text='File Size')
    content_type_mime = models.CharField(max_length=100, blank=True, null=True)
    
    #Sort & Text Replacements
    alt_text = models.CharField(max_length=255, blank=True, help_text="替代文字")
    
    #Time Stamps
    uploaded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

    @property
    def url(self):
        return self.firebase_url
    
    def create(self, firebase_path:str, firebase_url:str):
        self.firebase_path = firebase_path
        self.firebase_url = firebase_url

        self.save(firebase_path, firebase_url)

    def delete(self, *args, **kwargs):
        # 獲取 Firebase 路徑
        firebase_path = self.firebase_path
        
        # 如果有 Firebase 路徑，嘗試從 Firebase Storage 刪除
        if firebase_path:
            try:
                # 檢查是否是貼文圖片（子類 Image）
                if hasattr(self, 'postFrame'):
                    # 這是貼文圖片，使用相應的刪除方法
                    from utils.firebase_service import firebase_storage_service
                    success, message = firebase_storage_service.delete_post_image(firebase_path)
                    if not success:
                        logger.warning(f"從 Firebase Storage 刪除貼文圖片失敗: {message}")
                else:
                    # 這是其他類型的圖片（如頭像），使用 cleanup_old_headshot
                    cleanup_old_headshot(firebase_path)
            except Exception as e:
                logger.error(f"刪除 Firebase 圖片時發生錯誤: {str(e)}")
        
        # 從資料庫刪除記錄
        super().delete(*args, **kwargs)

class Image(SuperImage):
    postFrame = models.ForeignKey(PostFrame, on_delete=models.CASCADE, related_name='images', null=True, blank=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ['id', 'sort_order']
        indexes = [
            models.Index(fields=['id']),
            models.Index(fields=['firebase_path'])
        ]
    
    def create(self, postFrame: PostFrame, firebase_path:str, firebase_url:str):
        super().create(firebase_path=firebase_path, firebase_url=firebase_url)
        Image.objects.create(postFrame=postFrame)
    
    def get_first_image_url(self, postFrame: PostFrame):
        return self.objects.filter(post_frame=postFrame).order_by('sort_order').first().url()


class PetHeadshot(SuperImage):
    pet = models.OneToOneField(Pet, on_delete=models.CASCADE, related_name='headshot')
    
    @staticmethod
    def get_pet_headshot_url(pet):
        """獲取寵物頭像 URL"""
        try:
            headshot = PetHeadshot.objects.filter(pet=pet).first()
            return headshot.firebase_url if headshot else None
        except:
            return None


class UserHeadshot(SuperImage):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='headshot')
    
    @staticmethod
    def get_headshot_url(user):
        """獲取用戶頭像 URL"""
        try:
            headshot = UserHeadshot.objects.filter(user=user).first()
            return headshot.firebase_url if headshot else ""
        except:
            return ""
        
    @staticmethod
    def get_headshot(user):
        """獲取用戶頭像對象"""
        return UserHeadshot.objects.filter(user=user).first()
        
    @staticmethod
    def create(user, firebase_path: str, firebase_url: str):
        """創建用戶頭像記錄"""
        return UserHeadshot.objects.create(user=user, firebase_path=firebase_path, firebase_url=firebase_url)


class CheckpointHeadshot(SuperImage):
    """
    互動城市站點頭像模型
    用於儲存站點的代表圖片
    """
    checkpoint = models.OneToOneField(
        'interactivecity.Checkpoint', 
        on_delete=models.CASCADE, 
        related_name='headshot',
        help_text="關聯的站點"
    )
    
    @staticmethod
    def get_checkpoint_headshot_url(checkpoint):
        """獲取站點頭像 URL"""
        try:
            headshot = CheckpointHeadshot.objects.filter(checkpoint=checkpoint).first()
            return headshot.firebase_url if headshot else None
        except:
            return None
    
    @staticmethod
    def get_headshot(checkpoint):
        """獲取站點頭像對象"""
        return CheckpointHeadshot.objects.filter(checkpoint=checkpoint).first()
    
    @staticmethod
    def create(checkpoint, firebase_path: str, firebase_url: str, original_filename='', content_type='image/jpeg', file_size=None):
        """創建站點頭像記錄"""
        return CheckpointHeadshot.objects.create(
            checkpoint=checkpoint, 
            firebase_path=firebase_path, 
            firebase_url=firebase_url,
            original_filename=original_filename,
            content_type_mime=content_type,
            file_size=file_size,
            alt_text=f"{checkpoint.name} 站點頭像"
        )
    
    @staticmethod
    def update_or_create(checkpoint, firebase_path: str, firebase_url: str, original_filename='', content_type='image/jpeg', file_size=None):
        """更新或創建站點頭像記錄"""
        # 刪除舊頭像（如果存在）
        old_headshot = CheckpointHeadshot.objects.filter(checkpoint=checkpoint).first()
        if old_headshot and old_headshot.firebase_path:
            try:
                from utils.firebase_service import firebase_storage_service
                delete_success, delete_msg = firebase_storage_service.delete_image(old_headshot.firebase_path)
                if not delete_success:
                    logger.warning(f"刪除舊站點頭像失敗: {delete_msg}")
            except Exception as e:
                logger.warning(f"刪除舊站點頭像時發生異常: {str(e)}")
        
        # 創建或更新頭像記錄
        headshot, created = CheckpointHeadshot.objects.update_or_create(
            checkpoint=checkpoint,
            defaults={
                'firebase_url': firebase_url,
                'firebase_path': firebase_path,
                'original_filename': original_filename,
                'content_type_mime': content_type,
                'file_size': file_size,
                'alt_text': f"{checkpoint.name} 站點頭像"
            }
        )
        
        return headshot
    
    def save(self, *args, **kwargs):
        """覆寫 save 方法以自動生成 alt_text"""
        if not self.alt_text and self.checkpoint:
            self.alt_text = f"{self.checkpoint.name} 站點頭像"
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"CheckpointHeadshot for {self.checkpoint.name if self.checkpoint else 'Unknown'}"


# 異常貼文圖片
class AbnormalPostImage(SuperImage):
    """
    異常貼文圖片模型
    專門用於儲存異常記錄的圖片
    """
    abnormal_post = models.ForeignKey(
        'pets.AbnormalPost', 
        on_delete=models.CASCADE, 
        related_name='abnormal_images',
        help_text="關聯的異常貼文"
    )
    sort_order = models.IntegerField(
        default=0,
        help_text="圖片排序順序"
    )
    
    class Meta:
        ordering = ['abnormal_post', 'sort_order']
        indexes = [
            models.Index(fields=['abnormal_post', 'sort_order']),
        ]
        verbose_name = '異常貼文圖片'
        verbose_name_plural = '異常貼文圖片'
    
    def __str__(self):
        return f"AbnormalPostImage {self.id} for Post {self.abnormal_post.id}"
    
    def save(self, *args, **kwargs):
        """覆寫 save 方法以自動生成 alt_text"""
        if not self.alt_text and self.abnormal_post:
            self.alt_text = f"寵物 {self.abnormal_post.pet.pet_name} 的異常記錄圖片"
        super().save(*args, **kwargs)
    
    @classmethod
    def create_from_upload(cls, abnormal_post, firebase_url, firebase_path, 
                          sort_order=0, original_filename='', content_type='image/jpeg', file_size=None):
        """
        從上傳結果創建圖片記錄
        
        Parameters:
        - abnormal_post: AbnormalPost 實例
        - firebase_url: Firebase Storage URL
        - firebase_path: Firebase Storage 路徑
        - sort_order: 排序順序
        - original_filename: 原始檔案名稱
        - content_type: MIME 類型
        - file_size: 檔案大小
        
        Returns:
        - AbnormalPostImage 實例
        """
        return cls.objects.create(
            abnormal_post=abnormal_post,
            firebase_url=firebase_url,
            firebase_path=firebase_path,
            sort_order=sort_order,
            original_filename=original_filename,
            content_type_mime=content_type,
            file_size=file_size,
            alt_text=f"寵物 {abnormal_post.pet.pet_name} 的異常記錄圖片 {sort_order + 1}"
        )
    
    @classmethod
    def bulk_delete_with_firebase(cls, image_ids):
        """
        批量刪除圖片記錄並從 Firebase 刪除檔案
        
        Parameters:
        - image_ids: 圖片 ID 列表
        
        Returns:
        - tuple: (成功數量, 失敗數量, 錯誤詳情)
        """
        from utils.firebase_service import firebase_storage_service
        
        images = cls.objects.filter(id__in=image_ids)
        success_count = 0
        failed_count = 0
        errors = []
        
        for image in images:
            try:
                # 從 Firebase 刪除
                if image.firebase_path:
                    delete_success, delete_message = firebase_storage_service.delete_image(image.firebase_path)
                    if not delete_success:
                        errors.append({
                            'image_id': image.id,
                            'error': delete_message
                        })
                        failed_count += 1
                        continue
                
                # 從資料庫刪除
                image.delete()
                success_count += 1
                
            except Exception as e:
                errors.append({
                    'image_id': image.id,
                    'error': str(e)
                })
                failed_count += 1
        
        return success_count, failed_count, errors


# 飼料圖片
class FeedImage(SuperImage):
    """
    飼料圖片模型
    專門用於儲存飼料的正面和營養標籤圖片
    """
    IMAGE_TYPE_CHOICES = [
        ('front', '正面圖片'),
        ('nutrition', '營養標籤圖片'),
    ]
    
    feed = models.ForeignKey(
        'feeds.Feed',
        on_delete=models.CASCADE,
        related_name='feed_images',
        help_text="關聯的飼料"
    )
    image_type = models.CharField(
        max_length=20,
        choices=IMAGE_TYPE_CHOICES,
        help_text="圖片類型"
    )
    
    class Meta:
        ordering = ['feed', 'image_type']
        indexes = [
            models.Index(fields=['feed', 'image_type']),
        ]
        # 確保每個飼料的每種圖片類型只有一張
        unique_together = ['feed', 'image_type']
        verbose_name = '飼料圖片'
        verbose_name_plural = '飼料圖片'
    
    def __str__(self):
        return f"FeedImage {self.get_image_type_display()} for Feed {self.feed.id}"
    
    def save(self, *args, **kwargs):
        """覆寫 save 方法以自動生成 alt_text"""
        if not self.alt_text and self.feed:
            image_type_display = self.get_image_type_display()
            self.alt_text = f"{self.feed.brand} {self.feed.name} - {image_type_display}"
        super().save(*args, **kwargs)
    
    @classmethod
    def create_or_update(cls, feed, image_type, firebase_url, firebase_path, 
                        original_filename='', content_type='image/jpeg', file_size=None):
        """
        創建或更新飼料圖片記錄
        
        Parameters:
        - feed: Feed 實例
        - image_type: 圖片類型 ('front' 或 'nutrition')
        - firebase_url: Firebase Storage URL
        - firebase_path: Firebase Storage 路徑
        - original_filename: 原始檔案名稱
        - content_type: MIME 類型
        - file_size: 檔案大小
        
        Returns:
        - FeedImage 實例
        """
        # 刪除舊圖片（如果存在）
        old_image = cls.objects.filter(feed=feed, image_type=image_type).first()
        if old_image and old_image.firebase_path:
            try:
                from utils.firebase_service import firebase_storage_service
                delete_success, delete_msg = firebase_storage_service.delete_image(old_image.firebase_path)
                if not delete_success:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.warning(f"刪除舊飼料圖片失敗: {delete_msg}")
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"刪除舊飼料圖片時發生異常: {str(e)}")
        
        # 創建或更新圖片記錄
        feed_image, created = cls.objects.update_or_create(
            feed=feed,
            image_type=image_type,
            defaults={
                'firebase_url': firebase_url,
                'firebase_path': firebase_path,
                'original_filename': original_filename,
                'content_type_mime': content_type,
                'file_size': file_size,
                'alt_text': f"{feed.brand} {feed.name} - {'正面圖片' if image_type == 'front' else '營養標籤圖片'}"
            }
        )
        
        return feed_image
    
    @classmethod
    def get_feed_images(cls, feed):
        """
        獲取飼料的所有圖片
        
        Parameters:
        - feed: Feed 實例
        
        Returns:
        - dict: {'front': FeedImage or None, 'nutrition': FeedImage or None}
        """
        images = cls.objects.filter(feed=feed)
        result = {'front': None, 'nutrition': None}
        
        for image in images:
            result[image.image_type] = image
            
        return result


# 評論圖片
class CommentImage(SuperImage):
    """
    評論圖片模型
    專門用於儲存評論的圖片，支援 Django ContentType 框架
    """
    from django.contrib.contenttypes.models import ContentType
    from django.contrib.contenttypes.fields import GenericForeignKey
    
    # GenericForeignKey 支援
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    
    sort_order = models.IntegerField(
        default=0,
        help_text="圖片排序順序"
    )
    
    class Meta:
        ordering = ['content_type', 'object_id', 'sort_order']
        indexes = [
            models.Index(fields=['content_type', 'object_id', 'sort_order']),
        ]
        verbose_name = '評論圖片'
        verbose_name_plural = '評論圖片'
    
    def __str__(self):
        return f"CommentImage {self.id} for {self.content_type.name} {self.object_id}"
    
    def save(self, *args, **kwargs):
        """覆寫 save 方法以自動生成 alt_text"""
        if not self.alt_text:
            self.alt_text = f"評論圖片 {self.sort_order + 1}"
        super().save(*args, **kwargs)
    
    @classmethod
    def create_for_comment(cls, comment, firebase_url, firebase_path, 
                          sort_order=0, original_filename='', content_type='image/jpeg', file_size=None):
        """
        為評論創建圖片記錄
        
        Parameters:
        - comment: Comment 實例
        - firebase_url: Firebase Storage URL
        - firebase_path: Firebase Storage 路徑
        - sort_order: 排序順序
        - original_filename: 原始檔案名稱
        - content_type: MIME 類型
        - file_size: 檔案大小
        
        Returns:
        - CommentImage 實例
        """
        from django.contrib.contenttypes.models import ContentType
        comment_type = ContentType.objects.get_for_model(comment)
        
        return cls.objects.create(
            content_type=comment_type,
            object_id=comment.id,
            firebase_url=firebase_url,
            firebase_path=firebase_path,
            sort_order=sort_order,
            original_filename=original_filename,
            content_type_mime=content_type,
            file_size=file_size,
            alt_text=f"評論圖片 {sort_order + 1}"
        )


# 互動城市站點展示圖片
class CheckpointDisplayImage(SuperImage):
    """
    互動城市站點展示圖片模型
    專門用於儲存使用者在站點展示的寵物照片
    """
    from django.contrib.contenttypes.models import ContentType
    from django.contrib.contenttypes.fields import GenericForeignKey
    
    display_right = models.OneToOneField(
        'interactivecity.DisplayRight',
        on_delete=models.CASCADE,
        related_name='display_image',
        help_text="關聯的展示權記錄"
    )
    
    # 支援多種來源的圖片（寵物頭像、貼文圖片等）
    source_content_type = models.ForeignKey(
        ContentType, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        help_text="圖片來源類型"
    )
    source_object_id = models.PositiveIntegerField(null=True, blank=True)
    source_content_object = GenericForeignKey('source_content_type', 'source_object_id')
    
    # 展示設定
    caption = models.CharField(
        max_length=200, 
        blank=True,
        help_text="展示說明文字"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="是否啟用展示"
    )
    
    class Meta:
        verbose_name = '站點展示圖片'
        verbose_name_plural = '站點展示圖片'
        indexes = [
            models.Index(fields=['display_right']),
            models.Index(fields=['source_content_type', 'source_object_id']),
        ]
    
    def __str__(self):
        checkpoint_name = self.display_right.checkpoint.name if self.display_right else "Unknown"
        return f"CheckpointDisplayImage for {checkpoint_name}"
    
    def save(self, *args, **kwargs):
        """覆寫 save 方法以自動生成 alt_text"""
        if not self.alt_text and self.display_right:
            checkpoint = self.display_right.checkpoint
            user = self.display_right.user
            self.alt_text = f"{user.username} 在 {checkpoint.name} 的展示圖片"
        super().save(*args, **kwargs)
    
    @classmethod
    def create_from_pet_image(cls, display_right, pet_image_url, pet_image_path, 
                             pet=None, caption='', original_filename='', 
                             content_type='image/jpeg', file_size=None):
        """
        從寵物圖片創建站點展示圖片
        
        Parameters:
        - display_right: DisplayRight 實例
        - pet_image_url: 寵物圖片的 Firebase URL
        - pet_image_path: 寵物圖片的 Firebase 路徑
        - pet: Pet 實例（可選，用於設定來源）
        - caption: 展示說明文字
        - original_filename: 原始檔案名稱
        - content_type: MIME 類型
        - file_size: 檔案大小
        
        Returns:
        - CheckpointDisplayImage 實例
        """
        from django.contrib.contenttypes.models import ContentType
        
        display_image = cls(
            display_right=display_right,
            firebase_url=pet_image_url,
            firebase_path=pet_image_path,
            caption=caption,
            original_filename=original_filename,
            content_type_mime=content_type,
            file_size=file_size
        )
        
        # 設定來源為寵物（如果提供）
        if pet:
            display_image.source_content_type = ContentType.objects.get_for_model(pet)
            display_image.source_object_id = pet.id
        
        display_image.save()
        return display_image
    
    @classmethod 
    def create_from_upload(cls, display_right, firebase_url, firebase_path,
                          caption='', original_filename='', 
                          content_type='image/jpeg', file_size=None):
        """
        從用戶上傳創建站點展示圖片
        
        Parameters:
        - display_right: DisplayRight 實例
        - firebase_url: Firebase Storage URL
        - firebase_path: Firebase Storage 路徑
        - caption: 展示說明文字
        - original_filename: 原始檔案名稱
        - content_type: MIME 類型
        - file_size: 檔案大小
        
        Returns:
        - CheckpointDisplayImage 實例
        """
        return cls.objects.create(
            display_right=display_right,
            firebase_url=firebase_url,
            firebase_path=firebase_path,
            caption=caption,
            original_filename=original_filename,
            content_type_mime=content_type,
            file_size=file_size
        )
    
    @classmethod
    def get_current_display_image(cls, checkpoint):
        """
        獲取站點當前的展示圖片
        
        Parameters:
        - checkpoint: Checkpoint 實例
        
        Returns:
        - CheckpointDisplayImage 實例或 None
        """
        from interactivecity.models import DisplayRight
        from django.utils import timezone
        
        # 獲取當前有效的展示權
        current_display_right = DisplayRight.objects.filter(
            checkpoint=checkpoint,
            status='active',
            start_date__lte=timezone.now(),
            end_date__gte=timezone.now()
        ).first()
        
        if current_display_right:
            return cls.objects.filter(
                display_right=current_display_right,
                is_active=True
            ).first()
        
        return None
    
    @property
    def is_display_active(self):
        """檢查展示權是否仍然有效"""
        return (
            self.is_active and 
            self.display_right and 
            self.display_right.is_active
        )
    
    @property
    def days_remaining(self):
        """獲取剩餘展示天數"""
        if self.display_right:
            return self.display_right.days_remaining
        return 0