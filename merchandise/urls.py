from django.urls import path
from . import views


app_name = "merchandise"

urlpatterns = [
    path('', views.merchandise_view, name='merchandise'),
    path('cart/', views.cart_detail, name='cart'),
    path('checkout/', views.checkout, name='checkout'),
    path('cart/add/<int:product_id>/', views.add_to_cart, name='add_to_cart'),
    path('cart/update/<int:product_id>/', views.update_cart, name='update_cart'),
    path('cart/remove/<int:product_id>/', views.remove_from_cart, name='remove_from_cart'),
]