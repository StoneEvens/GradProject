from django.shortcuts import render, redirect
from django.contrib.auth import login
from Accounts.models import CustomUser
from django import forms

class CustomUserCreationForm(forms.ModelForm):
    class Meta:
        model = CustomUser
        fields = ["first_name", "username", "email", "password"]
        labels = {
            'first_name': 'Name',
        }

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data["password"])
        if commit:
            user.save()
        return user