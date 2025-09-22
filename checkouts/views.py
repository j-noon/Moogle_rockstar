import json
import stripe
from decimal import Decimal
from django.shortcuts import render, redirect, get_object_or_404
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse, HttpResponse
from django.urls import reverse
from django.contrib.auth.decorators import login_required

from .forms import CheckoutForm
from .models import Order, OrderItem
from .cart_utils import cart_subtotal_and_items

stripe.api_key = getattr(settings, 'STRIPE_SECRET_KEY', None)


def get_cart_from_session(request):
    return request.session.get('cart', {})


def compute_totals(session_cart):
    subtotal, items = cart_subtotal_and_items(session_cart)
    TAX_RATE = Decimal('0.00')  # change if needed
    shipping = Decimal('0.00')
    tax = (subtotal * TAX_RATE).quantize(Decimal('0.01'))
    total = (subtotal + tax + shipping).quantize(Decimal('0.01'))
    return subtotal, tax, shipping, total, items


def checkout_page(request):
    """
    GET: show form and totals
    POST: validate form -> create order + items -> create or reuse PaymentIntent -> render page with client_secret
    """
    # DEBUG: Check if Stripe keys are loaded
    stripe_secret_key = getattr(settings, 'STRIPE_SECRET_KEY', None)
    stripe_public_key = getattr(settings, 'STRIPE_PUBLIC_KEY', None)
    
    print("=== STRIPE KEYS DEBUG ===")
    print(f"STRIPE_SECRET_KEY exists: {bool(stripe_secret_key)}")
    print(f"STRIPE_PUBLIC_KEY exists: {bool(stripe_public_key)}")
    if stripe_public_key:
        print(f"STRIPE_PUBLIC_KEY value: {stripe_public_key[:20]}...")
    else:
        print("STRIPE_PUBLIC_KEY value: None or Empty")
    print("=========================")
    
    session_cart = get_cart_from_session(request)
    subtotal, tax, shipping, total, items = compute_totals(session_cart)

    if request.method == 'POST':
        form = CheckoutForm(request.POST)
        if form.is_valid():
            data = form.cleaned_data

            # If there is already an order id in session (user clicked back / refresh),
            # reuse that pending order instead of creating duplicates.
            order_id_in_session = request.session.get('pending_order_id')
            if order_id_in_session:
                try:
                    order = Order.objects.get(pk=order_id_in_session, status='pending')
                except Order.DoesNotExist:
                    order = None
            else:
                order = None

            if not order:
                order = Order.objects.create(
                    user=(request.user if request.user.is_authenticated else None),
                    first_name=data['first_name'],
                    last_name=data['last_name'],
                    email=data['email'],
                    phone=data.get('phone', ''),
                    address=f"{data['house_number']}, {data['street_name']}, {data['city']}, {data['postcode']}, {data['country']}",
                    subtotal=subtotal,
                    total=total,
                    status='pending'
                )

                # Save items:
                for it in items:
                    OrderItem.objects.create(
                        order=order,
                        product_id=it['product_id'],
                        product_name=it['name'],
                        quantity=it['quantity'],
                        unit_price=it['unit_price'],
                    )

            # Save pending_order_id into session to avoid duplication during refresh
            request.session['pending_order_id'] = order.id

            # If a payment intent already exists for this order, reuse it:
            client_secret = None
            if order.stripe_payment_intent:
                try:
                    pi = stripe.PaymentIntent.retrieve(order.stripe_payment_intent)
                    client_secret = pi.client_secret
                except Exception:
                    # if retrieval fails, clear the field and create new
                    order.stripe_payment_intent = None
                    order.save()

            if not client_secret:
                # create a new payment intent attached to this order
                intent = stripe.PaymentIntent.create(
                    amount=int(total * 100),  # amount in pence/cents
                    currency='gbp',
                    metadata={'order_id': str(order.id)},
                    receipt_email=order.email,
                )
                order.stripe_payment_intent = intent.id
                order.save()
                client_secret = intent.client_secret

            context = {
                'form': form,
                'items': items,
                'subtotal': subtotal,
                'tax': tax,
                'shipping': shipping,
                'total': total,
                'stripe_public_key': stripe_public_key or '',
                'client_secret': client_secret,
                'order': order,
            }
            print(f"DEBUG: Sending stripe_public_key to template (POST): {bool(stripe_public_key)}")
            return render(request, 'checkouts/checkout.html', context)
    else:
        form = CheckoutForm()

    context = {
        'form': form,
        'items': items,
        'subtotal': subtotal,
        'tax': tax,
        'shipping': shipping,
        'total': total,
        'stripe_public_key': stripe_public_key or '',
        'client_secret': None,
    }
    print(f"DEBUG: Sending stripe_public_key to template (GET): {bool(stripe_public_key)}")
    return render(request, 'checkouts/checkout.html', context)


def success_page(request, order_id=None):
    order = None
    if order_id:
        order = get_object_or_404(Order, pk=order_id)
    # clear pending_order_id from session if present
    if request.session.get('pending_order_id') == (order.id if order else None):
        del request.session['pending_order_id']
    return render(request, 'checkouts/success.html', {'order': order})


@login_required
def order_history(request):
    orders = request.user.orders.order_by('-created_at')
    return render(request, 'checkouts/order_history.html', {'orders': orders})


@csrf_exempt
def stripe_webhook(request):
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE', '')
    webhook_secret = getattr(settings, 'STRIPE_WEBHOOK_SECRET', None)
    event = None

    try:
        if webhook_secret:
            event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
        else:
            event = json.loads(payload)
    except Exception:
        return HttpResponse(status=400)

    # idempotency: check event type and process safe updates
    if event['type'] == 'payment_intent.succeeded':
        intent = event['data']['object']
        metadata = intent.get('metadata', {}) or {}
        order_id = metadata.get('order_id')
        if order_id:
            try:
                order = Order.objects.get(pk=int(order_id))
                # Only update if not already 'paid'
                if order.status != 'paid':
                    order.status = 'paid'
                    order.save()
                    # Optionally: clear user's cart:
                    # This webhook cannot access the session, so instruct frontend to clear cart after redirect.
                    # Or store cart snapshot in OrderItems (we already did)
                    # Send email receipt or create Download access entries here.
            except Order.DoesNotExist:
                pass

    elif event['type'] == 'payment_intent.payment_failed':
        intent = event['data']['object']
        metadata = intent.get('metadata', {}) or {}
        order_id = metadata.get('order_id')
        if order_id:
            try:
                order = Order.objects.get(pk=int(order_id))
                order.status = 'failed'
                order.save()
            except Order.DoesNotExist:
                pass

    # Add other events as needed (charge.refunded, etc.)
    return HttpResponse(status=200)