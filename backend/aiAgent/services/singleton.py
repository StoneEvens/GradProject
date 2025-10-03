"""
Singleton Service Manager
確保所有 AI 服務在後端啟動時載入一次，之後所有請求共用同一個實例
並在每次 API 請求時檢查向量資料庫是否過期（超過 24 小時）
"""

# 全局單例實例
_intent_service_instance = None


def get_intent_service():
    """
    取得 IntentService 單例實例
    每次調用時會檢查向量資料庫是否過期，如果過期會自動重新初始化

    Returns:
        IntentService: 全局共用的 IntentService 實例
    """
    global _intent_service_instance

    if _intent_service_instance is None:
        from .intent_service import IntentService
        print("🚀 初始化 IntentService 單例...")
        _intent_service_instance = IntentService()
        print("✅ IntentService 單例初始化完成")
    else:
        # 檢查並刷新過期的向量資料庫
        _check_and_refresh_vector_databases()

    return _intent_service_instance


def _check_and_refresh_vector_databases():
    """
    檢查所有向量資料庫是否過期，如果過期則重新初始化
    """
    global _intent_service_instance

    if _intent_service_instance is None:
        return

    try:
        vector_service = _intent_service_instance.vector_service

        # 檢查並刷新所有向量資料庫
        if hasattr(vector_service, '_social_post_db') and vector_service._social_post_db is not None:
            vector_service._social_post_db.check_and_refresh()

        if hasattr(vector_service, '_forum_post_db') and vector_service._forum_post_db is not None:
            vector_service._forum_post_db.check_and_refresh()

        if hasattr(vector_service, '_user_db') and vector_service._user_db is not None:
            vector_service._user_db.check_and_refresh()

        if hasattr(vector_service, '_feed_db') and vector_service._feed_db is not None:
            vector_service._feed_db.check_and_refresh()

    except Exception as e:
        print(f"⚠️ 檢查向量資料庫時發生錯誤: {str(e)}")


def reset_services():
    """
    重置所有服務實例（用於測試或重新載入）
    """
    global _intent_service_instance
    _intent_service_instance = None
    print("🔄 服務實例已重置")