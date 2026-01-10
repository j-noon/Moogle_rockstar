from django.urls import path
from django.views.generic import RedirectView  # Add this import
from . import views

app_name = "merchandise"

urlpatterns = [
    path('', views.merchandise_view, name='merchandise'),
    path('cart/', views.cart_detail, name='cart'),
    # Remove the duplicate checkout line and keep only the redirect:
    path('checkout/', RedirectView.as_view(pattern_name='checkouts:checkout', permanent=False)),
    path('cart/add/<int:product_id>/', views.add_to_cart, name='add_to_cart'),
    path('cart/update/<int:product_id>/', views.update_cart, name='update_cart'),
    path('cart/remove/<int:product_id>/', views.remove_from_cart, name='remove_from_cart'),
]
