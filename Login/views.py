from django.shortcuts import render, redirect
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth import login, authenticate

# Create your views here.
def index(request, *args, **kwargs):
    if request.method == 'POST':
        ##form = UserCreationForm(request.POST)
        ##if form.is_valid():
            ##user = form.save()
            ##login(request, user)  # Log in immediately after registration
            ##return redirect('home')  # Redirect upon success

            username = request.POST.get('username')
            password = request.POST.get('password')

            user = authenticate(request, username=username, password=password)

            if user is not None:
                login(request, user)
                return redirect('/home')
    else:
        form = UserCreationForm()

    return render(request, 'login/index.html', {'form': form})