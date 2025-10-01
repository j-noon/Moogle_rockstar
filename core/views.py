from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponseForbidden
from django.views.decorators.http import require_POST
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.mail import send_mail
from django.conf import settings
from django.urls import reverse

from .forms import ProfileImageForm, CommentForm, ResetPasswordForm
from .models import Profile, Comment

User = get_user_model()
token_generator = PasswordResetTokenGenerator()


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
    profile, _ = Profile.objects.get_or_create(user=request.user)
    form = ProfileImageForm(request.POST, request.FILES, instance=profile)
    if form.is_valid():
        profile = form.save()
        if request.headers.get('x-requested-with') == 'XMLHttpRequest':
            return JsonResponse({
                'message': 'Profile picture updated!',
                'image_url': profile.profile_image.url
            })
        messages.success(request, "Profile picture updated!")
        return redirect('home')

    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return JsonResponse({'errors': form.errors}, status=400)
    return HttpResponseBadRequest("Invalid form")


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

    all_comments = Comment.objects.all().order_by('-created_at')
    last_comment = Comment.objects.filter(user=request.user).order_by('-created_at').first()

    return render(request, 'core/home.html', {
        'form': form,
        'comments': all_comments,
        'last_user_comment': last_comment,
    })


# forgot and change password
def forgot_password(request):
    if request.method == "POST":
        email = request.POST.get("email")
        try:
            user = User.objects.get(email=email)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = token_generator.make_token(user)

            # build URL properly
            reset_url = request.build_absolute_uri(
                reverse("reset_password", kwargs={"uidb64": uid, "token": token})
            )

            send_mail(
                "Moogle-Rockstar Password Reset",
                f"Hi {user.username},\n\nClick the link below to reset your password:\n{reset_url}\n\nIf you didn’t request this, ignore it.",
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=False,
            )
            messages.success(request, "Password reset email sent. Check your inbox.")
            return redirect("login")
        except User.DoesNotExist:
            messages.error(request, "No account with that email found.")
    return render(request, "core/forgot_password.html")


def reset_password(request, uidb64, token):
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None

    if user is not None and token_generator.check_token(user, token):
        if request.method == "POST":
            form = ResetPasswordForm(request.POST)
            if form.is_valid():
                password = form.cleaned_data["password"]
                user.set_password(password)
                user.save()
                messages.success(request, "Password reset successful. You can log in now.")
                return redirect("login")
        else:
            form = ResetPasswordForm()
        return render(request, "core/reset_password.html", {"validlink": True, "form": form})
    else:
        return render(request, "core/reset_password.html", {"validlink": False})