from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.conf import settings
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_POST


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

    cancel_at_period_end = False
    if sub.stripe_subscription_id:
        try:
            s = stripe.Subscription.retrieve(sub.stripe_subscription_id)
            cancel_at_period_end = bool(s.get("cancel_at_period_end"))
            # keep current_period_end fresh from Stripe (useful for banner)
            cpe = s.get("current_period_end")
            if cpe:
                new_dt = timezone.datetime.fromtimestamp(cpe, tz=dt_tz.utc)
                if sub.current_period_end != new_dt:
                    sub.current_period_end = new_dt
                    sub.save(update_fields=["current_period_end"])
        except Exception:
            cancel_at_period_end = False  # fail closed to "no banner"

    # Friendly countdown
    days_left = None
    if sub.current_period_end:
        seconds = (sub.current_period_end - timezone.now()).total_seconds()
        days_left = max(0, math.ceil(seconds / 86400))

    return render(request, "subscriptions/manage.html", {
        "subscription": sub,
        "days_left": days_left,
        "cancel_at_period_end": cancel_at_period_end,
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
        s = stripe.Subscription.modify(sub.stripe_subscription_id, cancel_at_period_end=True)

        cpe = s.get("current_period_end")
        if cpe:
            sub.current_period_end = timezone.datetime.fromtimestamp(cpe, tz=dt_tz.utc)
            sub.save(update_fields=["current_period_end"])

        if sub.current_period_end:
            when = timezone.localtime(sub.current_period_end).strftime("%d %b %Y, %H:%M")
            messages.success(request, f"Subscription will be canceled at period end ({when}).")
        else:
            messages.success(request, "Subscription will be canceled at period end.")
    except stripe.error.StripeError as e:
        messages.error(request, f"Stripe error: {e.user_message or str(e)}")

    return redirect("subscriptions:manage")


@require_POST
@login_required
def resume_subscription(request):
    """
    If user previously set cancel_at_period_end=True but the sub is still active,
    this flips it back to keep the subscription running.
    """
    sub = Subscription.objects.filter(
        user=request.user, stripe_subscription_id__isnull=False
    ).first()
    if not sub:
        messages.error(request, "No subscription found to resume.")
        return redirect("subscriptions:manage")

    try:
        s = stripe.Subscription.retrieve(sub.stripe_subscription_id)
        if not s or not s.get("cancel_at_period_end"):
            messages.info(request, "Your subscription is already set to renew.")
            return redirect("subscriptions:manage")

        s = stripe.Subscription.modify(sub.stripe_subscription_id, cancel_at_period_end=False)

        cpe = s.get("current_period_end")
        if cpe:
            sub.current_period_end = timezone.datetime.fromtimestamp(cpe, tz=dt_tz.utc)
            sub.save(update_fields=["current_period_end"])

        messages.success(request, "Your subscription will continue after this period.")
    except stripe.error.StripeError as e:
        messages.error(request, f"Stripe error: {e.user_message or str(e)}")

    return redirect("subscriptions:manage")
