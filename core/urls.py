from django.urls import path
from . import views


urlpatterns = [
    path('', views.home, name='home'),
    path('gallery/', views.gallery, name='gallery'),
    path('merchandise/', views.merchandise, name='merchandise'),
    path('lets-play/', views.lets_play, name='lets_play'),
]

