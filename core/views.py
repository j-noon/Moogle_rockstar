from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.http import HttpResponseBadRequest, HttpResponseForbidden
from django.shortcuts import get_object_or_404

from .forms import ProfileImageForm, CommentForm
from .models import Profile, Comment  # Comment model is now in core.models


@login_required
@require_POST
def delete_comment(request):
    comment_id = request.POST.get('comment_id')
    comment = get_object_or_404(Comment, id=comment_id)

    if comment.user != request.user:
        return HttpResponseForbidden("You can only delete your own comments.")

    comment.delete()
    messages.success(request, "Comment deleted successfully.")
    return JsonResponse({'message': 'Comment deleted'})


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


def logout_view(request):
    logout(request)
    return redirect('login')


@login_required
def update_profile_image(request):
    if request.method == 'POST' and request.headers.get('x-requested-with') == 'XMLHttpRequest':
        # Ensure the user has a profile, create if missing
        profile = getattr(request.user, 'profile', None)
        if profile is None:
            profile = Profile.objects.create(user=request.user)

        form = ProfileImageForm(request.POST, request.FILES, instance=profile)
        if form.is_valid():
            form.save()
            return JsonResponse({'message': 'Profile picture updated!'})
        else:
            return JsonResponse({'errors': form.errors}, status=400)
    return JsonResponse({'error': 'Invalid request'}, status=400)


@login_required
def home(request):
    form = CommentForm()
    if request.method == 'POST':
        edit_id = request.POST.get('edit_comment_id')
        if edit_id:
            comment = Comment.objects.get(id=edit_id, user=request.user)
            form = CommentForm(request.POST, instance=comment)
        else:
            form = CommentForm(request.POST)

        if form.is_valid():
            comment = form.save(commit=False)
            comment.user = request.user
            comment.save()
            return redirect('home')

    # Get all comments
    all_comments = Comment.objects.all().order_by('-created_at')
    # Get the latest comment by the current user
    last_comment = Comment.objects.filter(user=request.user).order_by('-created_at').first()

    return render(request, 'core/home.html', {
        'form': form,
        'comments': all_comments,
        'last_user_comment': last_comment,
    })