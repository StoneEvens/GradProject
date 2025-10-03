from django.apps import AppConfig


class AiagentConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'aiAgent'

    def ready(self):
        """
        當 Django 應用啟動時執行
        在此預先載入 AI 服務，避免第一次請求時的延遲
        """
        import os
        import sys

        # 避免在 migrate、makemigrations 時載入服務
        if 'migrate' in sys.argv or 'makemigrations' in sys.argv:
            return

        # 避免在 runserver 的自動重載子進程中重複載入
        if os.environ.get('RUN_MAIN') != 'true':
            return

        try:
            from .services.singleton import get_intent_service
            print("\n" + "="*60)
            print("🚀 AI Agent 服務啟動中...")
            print("="*60)

            # 預先載入 IntentService 單例（包含 BERT 模型和向量資料庫）
            intent_service = get_intent_service()

            print("="*60)
            print("✅ AI Agent 服務已就緒，所有請求將共用此實例")
            print("="*60 + "\n")

        except Exception as e:
            print(f"⚠️  AI Agent 服務啟動失敗: {str(e)}")
            print("   服務將在第一次請求時嘗試載入")
            import traceback
            traceback.print_exc()
