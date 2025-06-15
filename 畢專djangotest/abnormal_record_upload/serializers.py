from rest_framework import serializers
from .models import SymptomRecord

SYMPTOM_CHOICES = [
    "食慾不佳",
    "嘔吐",
    "拉肚子",
    "咳嗽",
    "打噴嚏",
    "精神不濟",
    "喘氣",
]

class SymptomRecordSerializer(serializers.ModelSerializer):
    symptoms = serializers.ListField(
        child=serializers.ChoiceField(choices=SYMPTOM_CHOICES),
        allow_empty=True
    )
    image = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = SymptomRecord
        fields = '__all__'
