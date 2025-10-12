from django.utils import timezone


def user_has_active_subscription(user) -> bool:
    sub = getattr(user, "subscription", None)
    if not sub:
        return False
    if sub.status != "active":
        return False
    if sub.current_period_end and sub.current_period_end <= timezone.now():
        return False
    return True
