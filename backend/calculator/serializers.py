from rest_framework import serializers
from pets.models import Pet
from media.models import PetHeadshot


class PetSerializer(serializers.ModelSerializer):
    pet_avatar = serializers.SerializerMethodField()

    class Meta:
        model = Pet
        fields = [
            'id', 'pet_name', 'pet_type', 'pet_stage', 'weight', 'height',
            'predicted_adult_weight', 'weeks_of_lactation',
            'pet_avatar'
        ]

    def get_pet_avatar(self, pet: Pet):
        return PetHeadshot.get_pet_headshot_url(pet) if pet else None