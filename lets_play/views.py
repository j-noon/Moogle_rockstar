from django.shortcuts import render
from django.contrib.auth.decorators import login_required

@login_required
def lets_play_view(request):
    return render(request, 'lets_play/lets_play.html')
