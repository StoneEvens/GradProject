"""
URL configuration for PetAppDemo project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib.auth.views import LoginView, LogoutView
from django.urls import include, path
from django.contrib import admin
from django.contrib.auth.decorators import login_required
from Home.views import index as home

urlpatterns = [
    path('admin/', admin.site.urls),
    path('home/', login_required(home, login_url='/login/'), name='home'),
    path('login/', include('Login.urls'), name='login'),
    path('register/', include('Register.urls'), name='register'),
    #path('logout/', LogoutView.as_view(next_page='/login/'), name='logout'),
    path('ocrtest/', include('OCRTest.urls'), name='ocrtest'),
]
