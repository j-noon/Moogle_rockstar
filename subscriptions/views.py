from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.conf import settings
from django.urls import reverse
import stripe
from .models import Subscription

stripe.api_key = settings.STRIPE_SECRET_KEY

@login_required
def manage_subscription(request):
    sub, _ = Subscription.objects.get_or_create(user=request.user)
    return render(request, "subscriptions/manage.html", {"subscription": sub})

@login_required
def create_subscription_checkout(request):
    sub, _ = Subscription.objects.get_or_create(user=request.user)
    if sub.status == "active":
        messages.info(request, "Your subscription is already active.")
        return redirect("subscriptions:manage")

    success_url = request.build_absolute_uri(reverse("subscriptions:manage")) + "?status=success"
    cancel_url  = request.build_absolute_uri(reverse("subscriptions:manage")) + "?status=cancel"

    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": settings.STRIPE_SUB_PRICE_ID, "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        customer_email=request.user.email,
        client_reference_id=str(request.user.id),
        metadata={"user_id": str(request.user.id)},
        subscription_data={"metadata": {"user_id": str(request.user.id)}
        }
    )
    return redirect(session.url, code=303)

@login_required
def cancel_subscription(request):
    sub = Subscription.objects.filter(user=request.user, stripe_subscription_id__isnull=False).first()
    if not sub:
        messages.error(request, "No active subscription found to cancel.")
        return redirect("subscriptions:manage")

    try:
        stripe.Subscription.modify(sub.stripe_subscription_id, cancel_at_period_end=True)
        messages.success(request, "Subscription will be canceled at period end.")
    except stripe.error.StripeError as e:
        messages.error(request, f"Stripe error: {e.user_message or str(e)}")
    return redirect("subscriptions:manage")