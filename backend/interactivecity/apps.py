from django.apps import AppConfig


class InteractivecityConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'interactivecity'
    verbose_name = '互動城市'
    
    def ready(self):
        """當 app 準備就緒時執行的初始化代碼"""
        # 導入信號處理器（如果需要的話）
        try:
            from . import signals
        except ImportError:
            pass
