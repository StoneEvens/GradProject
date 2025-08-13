from django.apps import AppConfig


class SocialConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'social'
    _recommendation_service = None

    def ready(self):
        # Don't initialize the recommendation service here to avoid slow startup
        # It will be lazy-loaded when first accessed
        pass

    @classmethod
    def get_recommendation_service(cls):
        """Lazy-load the recommendation service when first accessed"""
        if cls._recommendation_service is None:
            from utils.recommendation_service import RecommendationService
            cls._recommendation_service = RecommendationService(content_type="social")
        return cls._recommendation_service
