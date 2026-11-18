"""
Pets Signals
處理寵物相關的信號事件
"""

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Pet, DiseaseArchiveContent


@receiver(post_save, sender=Pet)
def update_owner_vector_on_pet_save(sender, instance, created, **kwargs):
    """
    寵物創建或更新時，更新飼主的向量資料庫

    觸發時機：
    - 用戶新增寵物
    - 寵物資料更新（名稱、品種等）

    因為飼主的向量包含寵物資訊，所以寵物變更時需要更新飼主向量
    """
    if instance.owner:
        try:
            from aiAgent.services.user_vector_updater import update_user_vector
            update_user_vector(instance.owner)
        except Exception as e:
            print(f"⚠️ 更新飼主向量失敗（不影響寵物操作）: {str(e)}")


@receiver(post_delete, sender=Pet)
def update_owner_vector_on_pet_delete(sender, instance, **kwargs):
    """
    寵物刪除時，更新飼主的向量資料庫

    因為飼主的向量包含寵物資訊，所以寵物刪除時需要更新飼主向量

    注意：刪除使用者時，寵物會在同一個 cascade 中被刪除，此時 owner 那一列
    可能已經不存在，讀取 instance.owner 會丟出 CustomUser.DoesNotExist。
    以前這行在 try 之外，所以「刪除擁有寵物的帳號」一定會失敗。
    """
    try:
        owner = instance.owner
    except Exception:
        # 飼主已在同一次刪除中移除，沒有向量需要更新。
        return

    if owner:
        try:
            from aiAgent.services.user_vector_updater import update_user_vector
            update_user_vector(owner)
        except Exception as e:
            print(f"⚠️ 更新飼主向量失敗（不影響寵物操作）: {str(e)}")


@receiver(post_save, sender=DiseaseArchiveContent)
def update_disease_archive_vector_on_save(sender, instance, created, **kwargs):
    """
    疾病檔案創建或更新時，同步更新向量資料庫

    觸發時機：
    - 新增疾病檔案
    - 更新疾病檔案內容（症狀、治療等）
    - 更新隱私設定（公開/私人）

    邏輯：
    - 只有公開的疾病檔案（is_private=False）才會加入向量資料庫
    - 轉為私人時會從向量資料庫移除
    """
    try:
        from aiAgent.services.vector_service import VectorService
        vector_service = VectorService()

        # 檢查是否為公開狀態
        if not instance.is_private:
            # 公開：加入或更新向量資料庫
            vector_service.disease_archive_db.add_or_update_archive(instance)
            print(f"✅ 疾病檔案 {instance.id} 已加入向量資料庫（公開）")
        else:
            # 私人：如果存在於向量資料庫中，則移除
            vector_service.disease_archive_db.remove_archive(instance)
            print(f"🔒 疾病檔案 {instance.id} 已從向量資料庫移除（私人）")
    except Exception as e:
        print(f"⚠️ 更新疾病檔案向量失敗（不影響疾病檔案操作）: {str(e)}")
        import traceback
        traceback.print_exc()


@receiver(post_delete, sender=DiseaseArchiveContent)
def delete_disease_archive_vector_on_delete(sender, instance, **kwargs):
    """
    疾病檔案刪除時，從向量資料庫移除

    確保向量資料庫與資料庫保持同步
    """
    try:
        from aiAgent.services.vector_service import VectorService
        vector_service = VectorService()
        vector_service.disease_archive_db.remove_archive(instance)
    except Exception as e:
        print(f"⚠️ 刪除疾病檔案向量失敗（不影響疾病檔案操作）: {str(e)}")
        import traceback
        traceback.print_exc()