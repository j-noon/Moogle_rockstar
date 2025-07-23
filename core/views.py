from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.decorators import login_required
from .forms import ProfileImageForm  # NEW: import the form
from django.contrib import messages  # for optional feedback


# 🔹 Login view (unchanged)
def login_view(request):
    if request.user.is_authenticated:
        return redirect('home')
        
    if request.method == 'POST':
        username = request.POST['username']
        password = request.POST['password']
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            login(request, user)
            return redirect('home')
        else:
            return render(request, 'core/login.html', {
                'error': 'Invalid username or password'
            })
    return render(request, 'core/login.html')


# 🔹 Register view (unchanged)
def register_view(request):
    if request.user.is_authenticated:
        return redirect('home')
        
    if request.method == 'POST':
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect('home')
    else:
        form = UserCreationForm()
    return render(request, 'core/register.html', {'form': form})


# 🔹 Home view (unchanged)
@login_required
def home_view(request):
    return render(request, 'core/home.html')


# 🔹 Logout view (unchanged)
def logout_view(request):
    logout(request)
    return redirect('login')


# 🔹 NEW: Profile image update view
@login_required
def update_profile_image(request):
    if request.method == 'POST':
        form = ProfileImageForm(request.POST, request.FILES, instance=request.user.profile)
        if form.is_valid():
            form.save()
            messages.success(request, "Profile picture updated!")
            return redirect('home')
    else:
        form = ProfileImageForm(instance=request.user.profile)

    return render(request, 'core/update_profile.html', {'form': form})


@login_required
def update_moogles(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        score = data.get('score', 0)

        # Add score to user's moogles (assuming Profile model has `moogles` integer field)
        profile = request.user.profile
        profile.moogles += int(score)
        profile.save()

        return JsonResponse({'new_total': profile.moogles})

    return JsonResponse({'error': 'Invalid request'}, status=400)