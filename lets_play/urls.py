# lets_play/urls.py
from django.urls import path
from . import views


urlpatterns = [
    path('', views.lets_play_view, name='lets_play'),  # ✅ matches your actual view
]