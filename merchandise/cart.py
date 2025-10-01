from decimal import Decimal
from typing import Dict


CART_SESSION_KEY = "cart" 
MAX_QTY_PER_ITEM = 20




def _get_cart(session) -> Dict[str, int]:
    return session.get(CART_SESSION_KEY, {})




def _save_cart(session, cart: Dict[str, int]):
    session[CART_SESSION_KEY] = cart
    session.modified = True




def add_item(request, product_id: int, qty: int = 1):
    cart = _get_cart(request.session)
    pid = str(product_id)
    current = int(cart.get(pid, 0))
    new_qty = max(1, min(MAX_QTY_PER_ITEM, current + int(qty)))
    cart[pid] = new_qty
    _save_cart(request.session, cart)




def set_quantity(request, product_id: int, qty: int):
    cart = _get_cart(request.session)
    pid = str(product_id)
    qty = int(qty)
    if qty <= 0:
        cart.pop(pid, None)
    else:
        cart[pid] = min(MAX_QTY_PER_ITEM, qty)
    _save_cart(request.session, cart)




def remove_item(request, product_id: int):
    cart = _get_cart(request.session)
    pid = str(product_id)
    cart.pop(pid, None)
    _save_cart(request.session, cart)




def as_items(session, queryset):
    """Return a list of {product, quantity, subtotal} and a grand total.
    queryset should be Product.objects.filter(id__in=ids)
    """
    cart = _get_cart(session)
    items = []
    total = Decimal("0.00")
    for product in queryset:
        qty = int(cart.get(str(product.id), 0))
        if qty <= 0:
            continue
        subtotal = (product.price * qty).quantize(Decimal("0.01"))
        items.append({"product": product, "quantity": qty, "subtotal": subtotal})
        total += subtotal
    return items, total.quantize(Decimal("0.01"))