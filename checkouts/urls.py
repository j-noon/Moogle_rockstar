from django.urls import path
from . import views

app_name = 'checkouts'

urlpatterns = [
    path('', views.checkout_page, name='checkout'),
    path('success/', views.success_page, name='success'),
    path('history/', views.order_history, name='history'),
    path("stripe-webhook/", views.stripe_webhook, name="stripe_webhook"),
]