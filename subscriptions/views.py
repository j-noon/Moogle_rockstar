from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.conf import settings
from django.urls import reverse
from django.utils import timezone

from datetime import timezone as dt_tz
import math
import stripe

from .models import Subscription

stripe.api_key = settings.STRIPE_SECRET_KEY


# --- Map Stripe's statuses to your local enum ---
def _map_stripe_status_to_local(s: str) -> str:
    if s in {"active", "trialing"}:
        return "active"
    if s in {"past_due", "unpaid"}:
        return "past_due"
    if s in {"canceled", "incomplete_expired"}:
        return "canceled"
    return "inactive"


@login_required
def manage_subscription(request):
    sub, _ = Subscription.objects.get_or_create(user=request.user)

    # Optional: auto-heal from Stripe if status/date missing or weird
    if sub.stripe_subscription_id and (
        not sub.current_period_end
        or sub.status not in {"active", "canceled", "past_due", "inactive"}
    ):
        try:
            s = stripe.Subscription.retrieve(sub.stripe_subscription_id)
            sub.status = _map_stripe_status_to_local(s.get("status", sub.status))
            if s.get("customer"):
                sub.stripe_customer_id = s["customer"]
            cpe = s.get("current_period_end")
            if cpe:
                sub.current_period_end = timezone.datetime.fromtimestamp(cpe, tz=dt_tz.utc)
            sub.save()
        except Exception:
            # Don't break the page if Stripe is temporarily unreachable
            pass

    # Friendly countdown (ceil days, never negative)
    days_left = None
    if sub.current_period_end:
        seconds = (sub.current_period_end - timezone.now()).total_seconds()
        days_left = max(0, math.ceil(seconds / 86400))

    return render(request, "subscriptions/manage.html", {
        "subscription": sub,
        "days_left": days_left,
    })


@login_required
def create_subscription_checkout(request):
    sub, _ = Subscription.objects.get_or_create(user=request.user)

    # If already active, don't let them start another — just send them to manage
    if sub.status == "active":
        messages.info(request, "Your subscription is already active.")
        return redirect("subscriptions:manage")

    success_url = request.build_absolute_uri(reverse("subscriptions:manage")) + "?status=success"
    cancel_url = request.build_absolute_uri(reverse("subscriptions:manage")) + "?status=cancel"

    # Reuse an existing Stripe customer when possible (prevents duplicate Customers)
    customer_param = {}
    if sub.stripe_customer_id:
        customer_param["customer"] = sub.stripe_customer_id
    else:
        customer_param["customer_email"] = request.user.email

    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": settings.STRIPE_SUB_PRICE_ID, "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        client_reference_id=str(request.user.id),
        metadata={"user_id": str(request.user.id)},
        subscription_data={"metadata": {"user_id": str(request.user.id)}},
        **customer_param,
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
