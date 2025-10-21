from django.db import models
from django.contrib.auth.models import User

class Subscription(models.Model):
    STATUS_CHOICES = [
        ("active", "Active"),
        ("inactive", "Inactive"),
        ("canceled", "Canceled"),
        ("past_due", "Past Due"),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="subscription")
    stripe_customer_id = models.CharField(max_length=255, blank=True, null=True)
    stripe_subscription_id = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="inactive")
    current_period_end = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.user.username} — {self.status}"
