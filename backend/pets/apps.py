from django.apps import AppConfig


class PetsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'pets'
    _recommendation_service = None

    def ready(self):
        """應用初始化完成後執行"""
        # 導入信號處理器
        import pets.signals  # noqa
