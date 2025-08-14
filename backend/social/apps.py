from django.apps import AppConfig
import threading


class SocialConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'social'
    _recommendation_service = None

    def ready(self):
        if not hasattr(SocialConfig, '_init_started'):
            SocialConfig._init_started = True
            # Initialize in a separate thread
            threading.Thread(target=self._initialize_recommendation_service, daemon=True).start()
            print("請等待推薦服務初始化完成...")

    def _initialize_recommendation_service(self):
        """Initialize the recommendation service after a delay"""
        try:
            from utils.recommendation_service import RecommendationService
            if SocialConfig._recommendation_service is None:
                print("Initializing Social Recommendation Service")
                SocialConfig._recommendation_service = RecommendationService()
        except Exception as e:
            print(f"Error initializing recommendation service: {e}")

    @classmethod
    def get_recommendation_service(cls):
        return cls._recommendation_service
