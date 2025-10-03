"""
Feed Vector Updater
飼料向量資料庫更新服務（單例模式）
"""

from .singleton import get_intent_service


class FeedVectorUpdater:
    """飼料向量更新服務（單例）"""

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

    def get_feed_db(self):
        """獲取飼料向量資料庫實例"""
        if self._intent_service is None:
            self._intent_service = get_intent_service()
        return self._intent_service.vector_service.feed_db

    def update_feed_vector(self, feed):
        """
        更新飼料向量

        Args:
            feed: Feed 實例
        """
        try:
            feed_db = self.get_feed_db()
            feed_db.add_feed(feed)
        except Exception as e:
            print(f"更新飼料向量失敗: {str(e)}")
            import traceback
            traceback.print_exc()

    def remove_feed_vector(self, feed_id):
        """
        移除飼料向量

        Args:
            feed_id: 飼料 ID
        """
        try:
            feed_db = self.get_feed_db()
            feed_db.remove_feed(feed_id)
        except Exception as e:
            print(f"移除飼料向量失敗: {str(e)}")
            import traceback
            traceback.print_exc()


# 單例實例
_feed_vector_updater = FeedVectorUpdater()


def update_feed_vector(feed):
    """更新飼料向量（外部調用接口）"""
    _feed_vector_updater.update_feed_vector(feed)


def remove_feed_vector(feed_id):
    """移除飼料向量（外部調用接口）"""
    _feed_vector_updater.remove_feed_vector(feed_id)