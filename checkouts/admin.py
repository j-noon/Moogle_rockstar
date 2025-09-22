from django.contrib import admin
from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    readonly_fields = ('product_id', 'product_name', 'quantity', 'unit_price')
    extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'email', 'user', 'status', 'total', 'created_at')
    inlines = (OrderItemInline,)
    readonly_fields = ('created_at', 'updated_at')
    

@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ('order', 'product_name', 'quantity', 'unit_price')