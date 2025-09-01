from django import forms
from .models import AuctionResult


class WinnerSubmissionForm(forms.ModelForm):
    # 這不是 model 欄位，而是表單自訂欄位
    pet_photo = forms.ImageField(required=False)

    class Meta:
        model = AuctionResult
        fields = ["pet_name"]   # ⚠️ 不要放 pet_photo，避免 Django 找不到欄位

    def clean_pet_name(self):
        name = self.cleaned_data["pet_name"]
        if len(name.strip()) < 2:
            raise forms.ValidationError("寵物名字至少要 2 個字")
        return name.strip()
