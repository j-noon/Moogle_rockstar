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
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

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


# --- Webhook that creates orders after payment succeeds and sub activation ---
from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
def stripe_webhook(request):
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    endpoint_secret = settings.STRIPE_WEBHOOK_SECRET

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
        print("⚡ Event type:", event['type'])
        print("📦 Event data:", json.dumps(event['data']['object'], indent=2))
    except (ValueError, stripe.error.SignatureVerificationError) as e:
        print(f"Webhook error: {e}")
        return HttpResponse(status=400)

    # ---- HANDLE EVENTS ----

    # ✅ SHOP ORDERS
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
            return HttpResponse(status=200)

        # Create the order
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
        print(f"✅ Created Order {order.id} for user {user.email}")

        # Confirmation email
        try:
            context = {"first_name": first_name, "site_url": "https://moogle-rockstar-6c50ea141b04.herokuapp.com"}
            message = render_to_string("checkouts/email_order_confirmation.txt", context)
            send_mail("Your Moogle-Rockstar Order Confirmation", message, None, [order.email])
            print(f"✅ Confirmation email sent to {order.email}")
        except Exception as e:
            print(f"⚠️ Failed to send confirmation email: {e}")

        # Deduct moogles
        if moogles_spent > 0:
            profile = user.profile
            profile.moogles = max(0, profile.moogles - moogles_spent)
            profile.save()

        # Save order items
        try:
            cart = json.loads(cart_json)
        except json.JSONDecodeError:
            cart = {}

        for product_id_str, quantity in cart.items():
            try:
                product = Product.objects.get(pk=int(product_id_str))
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

    # ✅ CHECKOUT SESSION (separates shop vs subscription)
    elif event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        mode = session.get("mode")
        customer_email = session.get("customer_email")
        client_reference_id = session.get("client_reference_id")  # user id

        print(f"⚡ checkout.session.completed for mode={mode}, email={customer_email}")

        if mode == "subscription":
            try:
                from subscriptions.models import Subscription
                user = None

                customer_id = session.get("customer")
                stripe_sub_id = session.get("subscription")

                if client_reference_id:
                    user = User.objects.filter(id=client_reference_id).first()
                if not user:
                    email = (session.get("customer_details") or {}).get("email") or customer_email
                    if email:
                        user = User.objects.filter(email=email).first()

                if user:
                    # Try to read live subscription to get accurate status/period end
                    stripe_sub = None
                    try:
                        if stripe_sub_id:
                            stripe_sub = stripe.Subscription.retrieve(stripe_sub_id)
                    except Exception:
                        pass

                    defaults = {
                        "stripe_customer_id": customer_id,
                        "stripe_subscription_id": stripe_sub_id,
                    }
                    if stripe_sub:
                        defaults["status"] = stripe_sub.get("status", "active")
                        cpe = stripe_sub.get("current_period_end")
                        if cpe:
                            defaults["current_period_end"] = timezone.datetime.fromtimestamp(
                                cpe, tz=timezone.utc
                            )

                    else:
                        # If we can't retrieve yet, assume active when the session is paid
                        defaults["status"] = "active" if session.get("payment_status") == "paid" else "inactive"

                    Subscription.objects.update_or_create(
                        user=user,
                        defaults=defaults
                    )
                    print(f"✅ Linked subscription session to {user.email} (sub={stripe_sub_id})")
                else:
                    print("⚠️ No user found for subscription session")
            except Exception as e:
                print(f"⚠️ Failed handling checkout.session.completed (subscription): {e}")
                return HttpResponse(status=500)

        else:
            # Shop purchases handled by payment_intent.succeeded
            print("ℹ️ checkout.session.completed for payment – handled elsewhere")

    # ✅ SUBSCRIPTION CREATED
    elif event['type'] == 'customer.subscription.created':
        sub = event['data']['object']
        stripe_sub_id = sub.get('id')
        status = sub.get('status') or 'active'
        cpe_unix = sub.get('current_period_end')
        customer_id = sub.get('customer')
        user_id = (sub.get('metadata') or {}).get('user_id')

        from subscriptions.models import Subscription

        subscription = None
        if stripe_sub_id:
            subscription = Subscription.objects.filter(stripe_subscription_id=stripe_sub_id).first()
        if not subscription and customer_id:
            subscription = Subscription.objects.filter(stripe_customer_id=customer_id).first()

        user = None
        if subscription:
            user = subscription.user
        elif user_id:
            user = User.objects.filter(id=user_id).first()
        if not user and customer_id:
            try:
                cust = stripe.Customer.retrieve(customer_id)
                email = cust.get('email')
                if email:
                    user = User.objects.filter(email=email).first()
            except Exception:
                pass

        defaults = {
            "stripe_customer_id": customer_id,
            "stripe_subscription_id": stripe_sub_id,
            "status": status,
        }
        if cpe_unix:
            defaults["current_period_end"] = timezone.datetime.fromtimestamp(cpe_unix, tz=timezone.utc)

        if subscription:
            for k, v in defaults.items():
                setattr(subscription, k, v)
            subscription.save()
            print(f"✅ Subscription created/linked for {subscription.user.email} (status={status})")
        elif user:
            Subscription.objects.update_or_create(user=user, defaults=defaults)
            print(f"✅ Subscription created for {user.email} (status={status})")
        else:
            print(f"⚠️ Could not link subscription {stripe_sub_id} to a user")

    # ✅ SUBSCRIPTION UPDATED
    elif event['type'] == 'customer.subscription.updated':
        sub = event['data']['object']
        stripe_sub_id = sub.get('id')
        status = sub.get('status') or 'active'
        cpe_unix = sub.get('current_period_end')
        customer_id = sub.get('customer')

        from subscriptions.models import Subscription

        subscription = None
        if stripe_sub_id:
            subscription = Subscription.objects.filter(stripe_subscription_id=stripe_sub_id).first()
        if not subscription and customer_id:
            subscription = Subscription.objects.filter(stripe_customer_id=customer_id).first()

        if subscription:
            subscription.status = status
            if customer_id:
                subscription.stripe_customer_id = customer_id
            if cpe_unix:
                subscription.current_period_end = timezone.datetime.fromtimestamp(cpe_unix, tz=timezone.utc)
            subscription.save()
            print(f"🔄 Subscription {stripe_sub_id} updated to {status}")
        else:
            # Try to create if we can resolve a user
            user = None
            user_id = (sub.get('metadata') or {}).get('user_id')
            if user_id:
                user = User.objects.filter(id=user_id).first()
            if not user and customer_id:
                try:
                    cust = stripe.Customer.retrieve(customer_id)
                    email = cust.get('email')
                    if email:
                        user = User.objects.filter(email=email).first()
                except Exception:
                    pass

            if user:
                defaults = {
                    "stripe_customer_id": customer_id,
                    "stripe_subscription_id": stripe_sub_id,
                    "status": status,
                }
                if cpe_unix:
                    defaults["current_period_end"] = timezone.datetime.fromtimestamp(cpe_unix, tz=timezone.utc)
                    Subscription.objects.update_or_create(user=user, defaults=defaults)
                print(f"🔄 Created+linked subscription {stripe_sub_id} for {user.email} (status={status})")
            else:
                print(f"⚠️ Failed to update or link subscription {stripe_sub_id}")

    # ✅ SUBSCRIPTION DELETED
    elif event['type'] == 'customer.subscription.deleted':
        sub = event['data']['object']
        stripe_sub_id = sub.get('id')
        customer_id = sub.get('customer')

        from subscriptions.models import Subscription
        subscription = None
        if stripe_sub_id:
            subscription = Subscription.objects.filter(stripe_subscription_id=stripe_sub_id).first()
        if not subscription and customer_id:
            subscription = Subscription.objects.filter(stripe_customer_id=customer_id).first()

        if subscription:
            subscription.status = "canceled"
            subscription.save()
            print(f"❌ Subscription {stripe_sub_id} canceled")
        else:
            user = None
            user_id = (sub.get('metadata') or {}).get('user_id')
            if user_id:
                user = User.objects.filter(id=user_id).first()
            if not user and customer_id:
                try:
                    cust = stripe.Customer.retrieve(customer_id)
                    email = cust.get('email')
                    if email:
                        user = User.objects.filter(email=email).first()
                except Exception:
                    pass

            if user:
                Subscription.objects.update_or_create(
                    user=user,
                    defaults={
                        "stripe_customer_id": customer_id,
                        "stripe_subscription_id": stripe_sub_id,
                        "status": "canceled",
                    },
                )
                print(f"❌ Auto-created canceled subscription {stripe_sub_id} for {user.email}")
            else:
                print(f"⚠️ Could not link canceled subscription {stripe_sub_id}")

    # ✅ INVOICE PAYMENT SUCCEEDED → make sure subscription is active
    elif event['type'] == 'invoice.payment_succeeded':
        invoice = event['data']['object']
        customer_id = invoice.get('customer')
        # Subscription id can live in a few places; try them in order:
        subscription_id = invoice.get('subscription')
        if not subscription_id:
            parent = invoice.get('parent') or {}
            subscription_id = ((parent.get('subscription_details') or {}).get('subscription'))
        if not subscription_id:
            # Try first line item’s subscription_details
            lines = (invoice.get('lines') or {}).get('data') or []
            if lines:
                parent = lines[0].get('parent') or {}
                sub_details = parent.get('subscription_item_details') or {}
                subscription_id = sub_details.get('subscription')

        if not subscription_id and not customer_id:
            print("ℹ️ invoice.payment_succeeded without subscription/customer; nothing to do")
        else:
            from subscriptions.models import Subscription
            sub_row = None
            if subscription_id:
                sub_row = Subscription.objects.filter(stripe_subscription_id=subscription_id).first()
            if not sub_row and customer_id:
                sub_row = Subscription.objects.filter(stripe_customer_id=customer_id).first()

            if sub_row:
                sub_row.status = "active"
                # Set/refresh period end if we can infer it from the invoice lines
                try:
                    lines = (invoice.get('lines') or {}).get('data') or []
                    if lines and 'period' in lines[0]:
                        pe = lines[0]['period'].get('end')
                        if pe:
                            sub_row.current_period_end = timezone.datetime.fromtimestamp(pe, tz=timezone.utc)
                except Exception:
                    pass
                sub_row.save()
                print(f"💚 Forced active via invoice.payment_succeeded for sub={sub_row.stripe_subscription_id}")
            else:
                print(f"ℹ️ No Subscription row found for invoice; sub={subscription_id}, customer={customer_id}")

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