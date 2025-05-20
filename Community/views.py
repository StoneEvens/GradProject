from django.shortcuts import redirect, render

def index(request, *args, **kwargs):
    return render(request, 'community/index.html')