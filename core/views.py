from django.shortcuts import render


# Create your views here.


def login_view(request):
    return render(request, 'core/login.html')


def register_view(request):
    return render(request, 'core/register.html')


def home(request):
    return render(request, 'core/home.html')

def gallery(request):
    return render(request, 'core/gallery.html')


def merchandise(request):
    return render(request, 'core/merchandise.html')


def lets_play(request):
    return render(request, 'core/lets_play.html')


