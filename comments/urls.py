from django.urls import path
from . import views

urlpatterns = [
    path('add/', views.add_comment, name='add_comment'),
    path('edit/<int:pk>/', views.edit_comment, name='edit_comment'),
    path('delete/<int:pk>/', views.delete_comment, name='delete_comment'),
]