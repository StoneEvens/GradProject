from django.shortcuts import render, redirect
from .forms import CustomUserCreationForm
from django.contrib.auth import login
from django.http import JsonResponse

def index(request):
    if request.method == 'POST':
        print("POST data:", request.POST)  # Debug: Print POST data
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            print("Form is valid")
            user = form.save()
            login(request, user)
            return redirect('/home')
        else:
            print("Form errors:", form.errors)  # Debug: Print validation errors
    
    return render(request, 'register/index.html')