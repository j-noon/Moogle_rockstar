from decimal import Decimal
from django.shortcuts import get_object_or_404


from merchandise.models import Product


def cart_subtotal_and_items(session_cart):
    """
    session_cart expected shape: { "<product_id>": quantity, ... }
    returns (subtotal: Decimal, items: list_of_dicts)
    """
    subtotal = Decimal('0.00')
    items = []
    if not session_cart:
        return subtotal, items

    for pid_str, qty in session_cart.items():
        try:
            pid = int(pid_str)
        except (ValueError, TypeError):
            continue
        try:
            p = get_object_or_404(Product, pk=pid)
            price = Decimal(p.price)
            name = getattr(p, 'title', getattr(p, 'name', str(p)))
        except Exception:
            price = Decimal('0.00')
            name = f'Product {pid}'

        subtotal += price * int(qty)
        items.append({'product_id': pid, 'name': name, 'quantity': int(qty), 'unit_price': price})
    return subtotal.quantize(Decimal('0.01')), items