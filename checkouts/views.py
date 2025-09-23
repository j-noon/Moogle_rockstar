# checkouts/views.py
import json
from decimal import Decimal
from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.conf import settings
from django.http import HttpResponse
from .forms import CheckoutForm
from .models import Order, OrderItem
from merchandise.models import Product
import stripe

stripe.api_key = settings.STRIPE_SECRET_KEY

def checkout_page(request):
    session_cart = request.session.get('cart', {})

    # Compute totals
    items = []
    subtotal = Decimal('0.00')
    for product_id, quantity in session_cart.items():
        try:
            product = Product.objects.get(pk=product_id)
            total_price = product.price * Decimal(quantity)
            items.append({'product': product, 'quantity': quantity, 'total_price': total_price})
            subtotal += total_price
        except Product.DoesNotExist:
            continue

    tax_rate = Decimal('0.1')  # 10% VAT
    tax = (subtotal * tax_rate).quantize(Decimal('0.01'))
    shipping = Decimal('0.00' )  # digital products
    total = (subtotal + tax + shipping).quantize(Decimal('0.01'))

    client_secret = None
    if total > 0:
        intent = stripe.PaymentIntent.create(
            amount=int(total * 100),
            currency="gbp",
            metadata={
                "user_id": request.user.id,
                "cart": json.dumps(session_cart),
                "subtotal": str(subtotal),
                "total": str(total),
                "first_name": request.user.first_name,
                "last_name": request.user.last_name,
                "email": request.user.email,
            }
        )
        client_secret = intent.client_secret

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
    orders = Order.objects.filter(user=request.user).order_by('-created_at')
    return render(request, 'checkouts/order_history.html', {'orders': orders})


@login_required
def success_page(request, order_id=None):
    """
    Simple success page after payment.
    Clear the user's cart from session here.
    """
    if 'cart' in request.session:
        del request.session['cart']
    return render(request, 'checkouts/success.html')


# --- Webhook that creates orders after payment succeeds ---
from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
def stripe_webhook(request):
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    endpoint_secret = settings.STRIPE_WEBHOOK_SECRET

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, endpoint_secret
        )
    except ValueError:
        # Invalid payload
        return HttpResponse(status=400)
    except stripe.error.SignatureVerificationError:
        # Invalid signature
        return HttpResponse(status=400)

    # Handle the event
    if event['type'] == 'payment_intent.succeeded':
        payment_intent = event['data']['object']

        # Check if order already exists (avoid duplicates)
        if not Order.objects.filter(stripe_payment_intent=payment_intent['id']).exists():
            metadata = payment_intent.get('metadata', {})
            user_id = metadata.get('user_id')
            cart_json = metadata.get('cart', '{}')
            subtotal = Decimal(metadata.get('subtotal', '0.00'))
            total = Decimal(metadata.get('total', '0.00'))
            first_name = metadata.get('first_name', '')
            last_name = metadata.get('last_name', '')
            email = metadata.get('email', '')

            # Recreate order
            order = Order.objects.create(
                user_id=user_id,
                first_name=first_name,
                last_name=last_name,
                email=email,
                address="",  # address fields not sent in metadata; you can adjust if needed
                subtotal=subtotal,
                total=total,
                stripe_payment_intent=payment_intent['id'],
                status='paid',
            )

            # Recreate items
            try:
                cart = json.loads(cart_json)
            except json.JSONDecodeError:
                cart = {}

            for product_id_str, quantity in cart.items():
                product_id = int(product_id_str)
                try:
                    product = Product.objects.get(pk=product_id)
                    OrderItem.objects.create(
                        order=order,
                        product_id=product.id,
                        product_name=product.name,
                        quantity=quantity,
                        unit_price=product.price,
                    )
                except Product.DoesNotExist:
                    continue

    return HttpResponse(status=200)