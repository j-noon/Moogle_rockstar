from functools import wraps
from django.shortcuts import redirect
from django.contrib import messages
from django.urls import reverse
from .utils import user_has_active_subscription


def subscription_required(view_func):
    @wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            from django.contrib.auth.views import redirect_to_login
            return redirect_to_login(request.get_full_path())

        if user_has_active_subscription(request.user):
            return view_func(request, *args, **kwargs)

        sub = getattr(request.user, "subscription", None)
        if not sub:
            messages.warning(request, "You need a subscription to access this game.")
        elif sub.status == "past_due":
            messages.error(request, "Your payment is past due. Please update your payment method.")
        elif sub.status == "canceled":
            messages.info(request, "Your subscription is canceled. You can re-subscribe anytime.")
        else:
            messages.info(request, "Your subscription isn’t active. Please manage your plan.")

        return redirect(reverse("subscriptions:manage"))
    return _wrapped
