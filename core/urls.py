from django.urls import path
from django.views.generic.base import RedirectView
from . import views

urlpatterns = [
    path('', RedirectView.as_view(url='/login/')),  # Root redirects to login
    path('login/', views.login_view, name='login'),
    path('register/', views.register_view, name='register'),
    path('logout/', views.logout_view, name='logout'),
    path('home/', views.home_view, name='home'),  # Protected home page
]