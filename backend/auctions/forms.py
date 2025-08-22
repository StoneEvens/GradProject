from django import forms
from .models import AuctionResult


class WinnerSubmissionForm(forms.ModelForm):
    class Meta:
        model = AuctionResult
        fields = ["pet_name", "pet_photo"]

    def clean_pet_name(self):
        name = self.cleaned_data["pet_name"]
        if len(name) < 2:
            raise forms.ValidationError("Pet name must be at least 2 characters.")
        return name
