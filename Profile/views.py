from django.shortcuts import redirect, render

def index(request, *args, **kwargs):
    return render(request, 'profile/index.html')