from rest_framework import serializers
from calculator.models import Pet


class PetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pet
        fields = [
            'id', 'name', 'is_dog', 'life_stage', 'weight',
            'expect_adult_weight', 'litter_size', 'weeks_of_lactation',
            'pet_avatar'
        ]
