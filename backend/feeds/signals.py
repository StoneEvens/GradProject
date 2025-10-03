"""
Feeds Signals
處理飼料相關的信號事件
"""

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Feed


@receiver(post_save, sender=Feed)
def update_feed_vector_on_save(sender, instance, created, **kwargs):
    """
    飼料創建或更新時，更新向量資料庫

    觸發時機：
    - 新增飼料
    - 飼料資料更新（名稱、營養成分等）
    - 飼料驗證狀態變更

    只有已驗證（is_verified=True）的飼料會被索引
    """
    try:
        from aiAgent.services.feed_vector_updater import update_feed_vector
        update_feed_vector(instance)
    except Exception as e:
        print(f"⚠️ 更新飼料向量失敗（不影響飼料操作）: {str(e)}")


@receiver(post_delete, sender=Feed)
def remove_feed_vector_on_delete(sender, instance, **kwargs):
    """
    飼料刪除時，從向量資料庫移除
    """
    try:
        from aiAgent.services.feed_vector_updater import remove_feed_vector
        remove_feed_vector(instance.id)
    except Exception as e:
        print(f"⚠️ 移除飼料向量失敗（不影響飼料操作）: {str(e)}")