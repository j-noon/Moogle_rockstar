# checkouts/views.py
import os
import requests
from django.http import FileResponse, HttpResponseForbidden
from django.shortcuts import get_object_or_404
import json
from decimal import Decimal
from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.conf import settings
from django.http import HttpResponse
from django.contrib.auth import get_user_model
from .forms import CheckoutForm
from .models import Order, OrderItem
from merchandise.models import Product
import stripe
from django.template.loader import render_to_string
from django.core.mail import send_mail

User = get_user_model()
stripe.api_key = settings.STRIPE_SECRET_KEY


def checkout_page(request):
    session_cart = request.session.get('cart', {})

    # Compute totals
    items = []
    subtotal = Decimal('0.00')
    for product_id, quantity in session_cart.items():
        try:
            product = Product.objects.get(pk=product_id, is_active=True)
            total_price = product.price * Decimal(quantity)
            items.append({'product': product, 'quantity': quantity, 'total_price': total_price})
            subtotal += total_price
        except Product.DoesNotExist:
            continue

    tax_rate = Decimal('0.1')
    tax = (subtotal * tax_rate).quantize(Decimal('0.01'))
    shipping = Decimal('0.00')
    total = (subtotal + tax + shipping).quantize(Decimal('0.01'))

    profile = request.user.profile
    moogles_balance = profile.moogles
    moogles_to_spend = 0
    discount = Decimal('0.00')

    if request.method == "POST":
        form = CheckoutForm(request.POST)
        if form.is_valid():
            moogles_to_spend = min(
                form.cleaned_data.get('moogles_to_spend') or 0,
                moogles_balance
            )
            discount = Decimal(moogles_to_spend) / Decimal(1000)
            if discount > total:
                discount = total
                moogles_to_spend = int(total * 1000)
    else:
        form = CheckoutForm()

    final_total = (total - discount).quantize(Decimal('0.01'))

    client_secret = None
    if total > 0:
        intent = stripe.PaymentIntent.create(
            amount=int(total * 100),
            currency="gbp",
            metadata={
                "user_id": str(request.user.id),
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
    # Fetch orders linked to logged-in user
    orders = Order.objects.filter(user=request.user).order_by('-created_at')
    return render(request, 'checkouts/order_history.html', {'orders': orders})


@login_required
def success_page(request, order_id=None):
    """
    Success page after payment. Clears session cart.
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
        event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
    except (ValueError, stripe.error.SignatureVerificationError) as e:
        print(f"Webhook error: {e}")
        return HttpResponse(status=400)
    

    print("⚡ Incoming Stripe event:", event['type'])
    print("📦 Full metadata received:", event['data']['object'].get('metadata', {}))

    if event['type'] == 'payment_intent.succeeded':
        payment_intent = event['data']['object']

        if Order.objects.filter(stripe_payment_intent=payment_intent['id']).exists():
            print(f"Order already exists for PaymentIntent {payment_intent['id']}")
            return HttpResponse(status=200)

        metadata = payment_intent.get('metadata', {})
        user_id = metadata.get('user_id')
        cart_json = metadata.get('cart', '{}')
        subtotal = Decimal(metadata.get('subtotal', '0.00'))
        total = Decimal(metadata.get('total', '0.00'))
        first_name = metadata.get('first_name', '')
        last_name = metadata.get('last_name', '')
        email = metadata.get('email', '')
        moogles_spent = int(metadata.get('moogles_spent', 0))

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            print(f"Webhook error: user {user_id} not found. Cannot create order.")
            return HttpResponse(status=400)


        order = Order.objects.create(
            user=user,
            first_name=first_name,
            last_name=last_name,
            email=email,
            address="",
            subtotal=subtotal,
            total=total,
            stripe_payment_intent=payment_intent['id'],
            status='paid',
            moogles_spent=moogles_spent,
        )
        print(f"Created Order {order.id} for user {user.email}")


        try:
            context = {
                "first_name": first_name,
                "site_url": "https://moogle-rockstar-6c50ea141b04.herokuapp.com",  # your site
            }
            message = render_to_string("checkouts/email_order_confirmation.txt", context)

            send_mail(
                subject="Your Moogle-Rockstar Order Confirmation",
                message=message,
                from_email=None,  # uses DEFAULT_FROM_EMAIL
                recipient_list=[order.email],
                fail_silently=False,
            )
            print(f"✅ Confirmation email sent to {order.email}")
        except Exception as e:
            print(f"⚠️ Failed to send confirmation email: {e}")

        if moogles_spent > 0:
            profile = user.profile
            profile.moogles = max(0, profile.moogles - moogles_spent)
            profile.save()

        
        try:
            cart = json.loads(cart_json)
        except json.JSONDecodeError:
            cart = {}

        for product_id_str, quantity in cart.items():
            try:
                product_id = int(product_id_str)
                product = Product.objects.get(pk=product_id)
                OrderItem.objects.create(
                    order=order,
                    product_id=product.id,
                    product_name=product.name,
                    quantity=quantity,
                    unit_price=product.price,
                    image_url=product.image_url,
                )
                print(f"Added {quantity} x {product.name} to Order {order.id}")
            except Product.DoesNotExist:
                print(f"Product {product_id_str} not found. Skipping item.")
                continue

    return HttpResponse(status=200)



@login_required
def download_asset(request, item_id):
    order_item = get_object_or_404(OrderItem, id=item_id)

    if order_item.order.user != request.user:
        return HttpResponseForbidden("You don’t own this order.")

    if order_item.order.status != "paid":
        return HttpResponseForbidden("Payment not confirmed.")

    if order_item.asset_file:
        file_path = order_item.asset_file.path
        return FileResponse(
            open(file_path, "rb"),
            as_attachment=True,
            filename=os.path.basename(file_path)
        )
    elif order_item.image_url:
        try:
            response = requests.get(order_item.image_url, stream=True)
            response.raise_for_status()
            filename = os.path.basename(order_item.image_url)
            resp = HttpResponse(
                response.raw,
                content_type=response.headers.get("Content-Type", "application/octet-stream")
            )
            resp['Content-Disposition'] = f'attachment; filename="{filename}"'
            return resp
        except requests.RequestException:
            return HttpResponse("Failed to fetch asset from Cloudinary.", status=500)
    else:
        return HttpResponse("No asset available.", status=404)