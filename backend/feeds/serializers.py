from rest_framework import serializers
from feeds.models import Feed

class FeedSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feed
        fields = [
            "id",
            "user_id",
            "name",
            "brand",
            "protein",
            "fat",
            "carbohydrate",
            "calcium",
            "phosphorus",
            "magnesium",
            "sodium",
            "front_image_url",
            "nutrition_image_url",
        ]
