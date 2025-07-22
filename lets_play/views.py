from django.shortcuts import render


# Create your views here.


def lets_play_view(request):
    return render(request, 'lets_play/lets_play.html')
