"""
Accounts Signals
處理用戶相關的信號事件
"""

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import CustomUser


@receiver(post_save, sender=CustomUser)
def update_user_vector_on_save(sender, instance, created, **kwargs):
    """
    用戶創建或更新時，更新向量資料庫

    觸發時機：
    - 用戶註冊
    - 用戶資料更新（名稱、隱私設定等）
    """
    try:
        from aiAgent.services.user_vector_updater import update_user_vector
        update_user_vector(instance)
    except Exception as e:
        # 避免影響正常的用戶操作
        print(f"⚠️ 更新用戶向量失敗（不影響用戶操作）: {str(e)}")


@receiver(post_delete, sender=CustomUser)
def remove_user_vector_on_delete(sender, instance, **kwargs):
    """
    用戶刪除時，從向量資料庫移除
    """
    try:
        from aiAgent.services.user_vector_updater import remove_user_vector
        remove_user_vector(instance.id)
    except Exception as e:
        print(f"⚠️ 移除用戶向量失敗（不影響用戶操作）: {str(e)}")