import uuid
from django.db import models
from django.contrib.auth.models import User


class PlayToken(models.Model):
    """
    One-time token issued when a game starts.
    Server verifies it's signed, belongs to the user, not expired, not used.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="play_tokens")
    game = models.CharField(max_length=50)
    max_award = models.PositiveIntegerField(default=50)
    issued_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"PlayToken({self.id}) for {self.user} game={self.game}"


class MoogleAward(models.Model):
    """
    Audit trail of moogles awarded.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="moogle_awards")
    game = models.CharField(max_length=50)
    amount = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    def __str__(self):
        return f"{self.user} +{self.amount} ({self.game}) @ {self.created_at:%Y-%m-%d %H:%M:%S}"
