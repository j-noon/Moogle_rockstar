from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
from django.urls import reverse

from core.models import Profile
from subscriptions.decorators import subscription_required
from subscriptions.utils import user_has_active_subscription
import json


@login_required
def lets_play_view(request):
    """
    Renders the game page. Server-side gated so only active subscribers
    (and non-expired period) can access.
    """
    return render(
        request,
        "lets_play/lets_play.html",
        {
            # expose state for your subscription_gate.js
            "is_subscribed": user_has_active_subscription(request.user),
            "subscribe_url": reverse("subscriptions:manage"),
        },
    )


@csrf_exempt
@require_POST
@login_required
@subscription_required
def update_moogles(request):
    """
    Award moogles via AJAX. Also gated to prevent bypassing the UI
    (e.g. direct POSTs when the user isn't subscribed).
    """
    try:
        data = json.loads(request.body.decode("utf-8") or "{}")
        score = int(data.get("score", 0))

        profile, _ = Profile.objects.get_or_create(user=request.user)
        profile.moogles += score
        profile.save()

        return JsonResponse({"new_total": profile.moogles})
    except (ValueError, TypeError):
        return JsonResponse({"error": "Invalid score."}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)
