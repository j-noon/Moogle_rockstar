from django.urls import path
from . import views

urlpatterns = [
    path('', views.merchandise_view, name='merchandise'),
]