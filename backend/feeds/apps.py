from django.apps import AppConfig


class FeedsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'feeds'

    def ready(self):
        """應用初始化完成後執行"""
        # 導入信號處理器
        import feeds.signals  # noqa
