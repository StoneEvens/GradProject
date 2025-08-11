from django.apps import AppConfig
from utils.recommendation_service import RecommendationService


class SocialConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'social'

    def ready(self):
        # Initialize the recommendation service as an instance attribute
        self.recommendation_service = RecommendationService()
