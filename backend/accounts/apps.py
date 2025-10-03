from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accounts'

    def ready(self):
        """應用初始化完成後執行"""
        # 導入信號處理器
        import accounts.signals  # noqa
