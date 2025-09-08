from rest_framework import serializers
from .models import Bid

class BidSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bid
        fields = ["id", "session", "user", "amount", "created_at"]
        read_only_fields = ["id", "user", "created_at"]
