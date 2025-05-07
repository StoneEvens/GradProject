from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User

class CustomUserCreationForm(UserCreationForm):
    #email = forms.EmailField(required=True)
    #name = forms.CharField(required=True)  # You can map this to first_name or a separate profile model

    class Meta:
        model = User
        #fields = ("username", "email", "name", "password1", "password2")
        fields = ("username", "password1", "password2")