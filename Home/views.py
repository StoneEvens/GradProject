from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect

# Create your views here.
@login_required(login_url='/login/')
def index(request, *args, **kwargs):
    return render(request, 'home/index.html')