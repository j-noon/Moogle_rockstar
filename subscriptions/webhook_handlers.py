from django.utils import timezone
from datetime import datetime
from django.contrib.auth import get_user_model
from .models import Subscription

User = get_user_model()


def _epoch_to_dt(ts):
    return datetime.fromtimestamp(ts, tz=timezone.utc) if ts else None


def handle_checkout_completed(event):
    session = event['data']['object']
    if session.get("mode") != "subscription":
        return
    user_id = session.get("client_reference_id") or session.get("metadata", {}).get("user_id")
    stripe_sub_id = session.get("subscription")
    stripe_customer_id = session.get("customer")
    if not (user_id and stripe_sub_id):
        return
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return

    sub, _ = Subscription.objects.get_or_create(user=user)
    sub.stripe_customer_id = stripe_customer_id
    sub.stripe_subscription_id = stripe_sub_id
    sub.status = "active"
    sub.save()


def handle_invoice_succeeded(event):
    invoice = event['data']['object']
    stripe_sub_id = invoice.get("subscription")
    if not stripe_sub_id:
        return
    sub = Subscription.objects.filter(stripe_subscription_id=stripe_sub_id).first()
    if not sub:
        return
    lines = invoice.get("lines", {}).get("data", [])
    if lines:
        period = lines[0].get("period", {})
        end_ts = period.get("end")
        sub.current_period_end = _epoch_to_dt(end_ts)
    sub.status = "active"
    sub.save()


def handle_subscription_deleted(event):
    stripe_sub = event['data']['object']
    stripe_sub_id = stripe_sub.get("id")
    if not stripe_sub_id:
        return
    sub = Subscription.objects.filter(stripe_subscription_id=stripe_sub_id).first()
    if not sub:
        return
    sub.status = "canceled"
    sub.current_period_end = _epoch_to_dt(stripe_sub.get("current_period_end"))
    sub.save()


def handle_subscription_updated(event):
    stripe_sub = event['data']['object']
    stripe_sub_id = stripe_sub.get("id")
    if not stripe_sub_id:
        return
    sub = Subscription.objects.filter(stripe_subscription_id=stripe_sub_id).first()
    if not sub:
        return
    status_map = {
        "active": "active",
        "past_due": "past_due",
        "canceled": "canceled",
        "incomplete": "inactive",
        "incomplete_expired": "inactive",
        "unpaid": "past_due",
        "trialing": "active",
    }
    sub.status = status_map.get(stripe_sub.get("status"), "inactive")
    sub.current_period_end = _epoch_to_dt(stripe_sub.get("current_period_end"))
    sub.save()
