from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import HttpResponseForbidden
from django.views.decorators.http import require_POST
from .models import Comment
from .forms import CommentForm

def get_comments_context(request):
    """Shared context for all comment views"""
    return {
        'comments': Comment.objects.all().order_by('-created_at'),
        'last_user_comment': Comment.objects.filter(user=request.user).first(),
        'form': CommentForm()
    }

@login_required
def add_comment(request):
    """Handles new comment creation"""
    context = get_comments_context(request)
    
    if request.method == 'POST':
        form = CommentForm(request.POST)
        if form.is_valid():
            comment = form.save(commit=False)
            comment.user = request.user
            comment.save()
            messages.success(request, f"Thank you for your comment, {request.user.username}!")
            return redirect('home')
    
    # If GET request or invalid form
    return render(request, 'comments/comments_section.html', context)

@login_required
def edit_comment(request, pk):
    """Handles comment editing"""
    comment = get_object_or_404(Comment, id=pk, user=request.user)
    context = get_comments_context(request)
    
    if request.method == 'POST':
        form = CommentForm(request.POST, instance=comment)
        if form.is_valid():
            form.save()
            messages.success(request, "Comment updated successfully!")
            return redirect('home')
    
    # Pre-populate form for GET requests
    context['form'] = CommentForm(instance=comment)
    return render(request, 'comments/comments_section.html', context)

@login_required
@require_POST
def delete_comment(request, pk):
    """Handles comment deletion"""
    comment = get_object_or_404(Comment, id=pk, user=request.user)
    comment.delete()
    messages.success(request, "Comment deleted successfully.")
    return redirect('home')