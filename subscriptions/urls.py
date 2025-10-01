from django.urls import path
from . import views

app_name = "subscriptions"

urlpatterns = [
    path("manage/", views.manage_subscription, name="manage"),
    path("subscribe/", views.create_subscription_checkout, name="subscribe"),
    path("cancel/", views.cancel_subscription, name="cancel"),
]