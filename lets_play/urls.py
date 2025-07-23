from django.urls import path
from . import views
from .views import lets_play_view, update_moogles

urlpatterns = [
    path('', views.lets_play_view, name='lets_play'),
    path('update-moogles/', update_moogles, name='update_moogles'),
]