# checkouts/views.py
from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.conf import settings
from .forms import CheckoutForm
from .models import Order, OrderItem
from merchandise.models import Product
import stripe

stripe.api_key = settings.STRIPE_SECRET_KEY


def checkout_page(request):
    session_cart = request.session.get('cart', {})

    # Compute totals
    items = []
    subtotal = 0
    for product_id, quantity in session_cart.items():
        try:
            product = Product.objects.get(pk=product_id)
            total_price = product.price * quantity
            items.append({'product': product, 'quantity': quantity, 'total_price': total_price})
            subtotal += total_price
        except Product.DoesNotExist:
            continue

    tax = subtotal * 0.1
    shipping = 5 if subtotal > 0 else 0
    total = subtotal + tax + shipping

    # Always create a PaymentIntent if there’s something in the cart
    client_secret = None
    if total > 0:
        intent = stripe.PaymentIntent.create(
            amount=int(total * 100),  # in pence
            currency="gbp",
        )
        client_secret = intent.client_secret

    if request.method == "POST":
        form = CheckoutForm(request.POST)
        if form.is_valid():
            # Save the order
            order = form.save(commit=False)
            order.user = request.user if request.user.is_authenticated else None
            order.total_amount = total
            order.save()

            # Save each item
            for item in items:
                OrderItem.objects.create(
                    order=order,
                    product=item['product'],
                    quantity=item['quantity'],
                    price=item['product'].price,
                )

            # Clear cart
            request.session['cart'] = {}

            # ✅ Redirect user to their orders page
            return redirect("orders:user_orders")  # adjust to your orders URL name

    else:
        form = CheckoutForm()

    context = {
        "form": form,
        "items": items,
        "subtotal": subtotal,
        "tax": tax,
        "shipping": shipping,
        "total": total,
        "stripe_public_key": settings.STRIPE_PUBLIC_KEY,
        "client_secret": client_secret,
    }
    return render(request, "checkouts/checkout.html", context)


@login_required
def order_history(request):
    """
    Show all orders belonging to the logged-in user
    """
    orders = Order.objects.filter(user=request.user).order_by('-created_at')
    return render(request, 'checkouts/order_history.html', {
        'orders': orders
    })


def success_page(request, order_id=None):
    """
    Simple success page after payment
    """
    return render(request, 'checkouts/success.html')


def stripe_webhook(request):
    """
    Basic webhook handler (you'll need this for production)
    """
    return HttpResponse(status=200)