"""
User Vector Updater
用戶向量資料庫更新服務（單例模式）
"""

from .singleton import get_intent_service


class UserVectorUpdater:
    """用戶向量更新服務（單例）"""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._intent_service = None

    def get_user_db(self):
        """獲取用戶向量資料庫實例"""
        if self._intent_service is None:
            self._intent_service = get_intent_service()
        return self._intent_service.vector_service.user_db

    def update_user_vector(self, user):
        """
        更新用戶向量

        Args:
            user: CustomUser 實例
        """
        try:
            user_db = self.get_user_db()
            user_db.add_user(user)
        except Exception as e:
            print(f"更新用戶向量失敗: {str(e)}")
            import traceback
            traceback.print_exc()

    def remove_user_vector(self, user_id):
        """
        移除用戶向量

        Args:
            user_id: 用戶 ID
        """
        try:
            user_db = self.get_user_db()
            user_db.remove_user(user_id)
        except Exception as e:
            print(f"移除用戶向量失敗: {str(e)}")
            import traceback
            traceback.print_exc()


# 單例實例
_user_vector_updater = UserVectorUpdater()


def update_user_vector(user):
    """更新用戶向量（外部調用接口）"""
    _user_vector_updater.update_user_vector(user)


def remove_user_vector(user_id):
    """移除用戶向量（外部調用接口）"""
    _user_vector_updater.remove_user_vector(user_id)