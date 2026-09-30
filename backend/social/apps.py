import os
from django.apps import AppConfig
import threading


class SocialConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'social'
    _recommendation_service = None

    def ready(self):
        # Pre-loading the model at startup is an optimisation, not a requirement:
        # get_recommendation_service() builds it on first use either way. On shared
        # hosting where the account has a thread cap, Thread().start() can raise and
        # take the whole application down before Django finishes booting, so this is
        # both optional (RECOMMENDATIONS_EAGER_INIT=False) and never fatal.
        if os.environ.get('RECOMMENDATIONS_EAGER_INIT', 'True').lower() in ('false', '0', 'no'):
            print("推薦服務將於首次使用時初始化 (RECOMMENDATIONS_EAGER_INIT=False)")
            return

        if not hasattr(SocialConfig, '_init_started'):
            SocialConfig._init_started = True
            try:
                # Initialize in a separate thread
                threading.Thread(target=self._initialize_recommendation_service, daemon=True).start()
                print("請等待推薦服務初始化完成...")
            except Exception as e:
                # e.g. "can't start new thread" under a shared-hosting thread limit
                print(f"無法在啟動時初始化推薦服務，將於首次使用時載入: {e}")

    def _initialize_recommendation_service(self):
        """Initialize the recommendation service after a delay"""
        try:
            from utils.recommendation_service import RecommendationService
            if SocialConfig._recommendation_service is None:
                print("Getting RecommendationService instance")
                SocialConfig._recommendation_service = RecommendationService()
        except Exception as e:
            print(f"Error initializing recommendation service: {e}")

    @classmethod
    def get_recommendation_service(cls):
        if cls._recommendation_service is None:
            from utils.recommendation_service import RecommendationService
            cls._recommendation_service = RecommendationService()
        return cls._recommendation_service
