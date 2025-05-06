from django.shortcuts import render, redirect
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth import login, authenticate

def index(request):
    if request.method == 'POST':
        ##form = UserCreationForm(request.POST)
        username = request.POST.get('username')
        password = request.POST.get('password')

        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)
            return redirect('/home')

        ##if form.is_valid():
            # This creates a new User using Django’s built-in model.
            ##user = form.save()
            # Immediately log in the new user.
            ##login(request, user)
            ##return redirect('home')
    else:
        form = UserCreationForm()
    return render(request, 'register/index.html', {'form': form})