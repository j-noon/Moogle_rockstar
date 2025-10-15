import json
from datetime import timedelta
from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.http import JsonResponse
from django.shortcuts import render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
from django.core.signing import TimestampSigner, BadSignature, SignatureExpired

from core.models import Profile
from subscriptions.decorators import subscription_required
from subscriptions.utils import user_has_active_subscription
from .models import PlayToken, MoogleAward


AWARD_COOLDOWN = timedelta(seconds=50)
TOKEN_MAX_AGE = 90
GLOBAL_MAX_AWARD = 50

FREE_GAMES = {"memory"}


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
            "is_subscribed": user_has_active_subscription(request.user),
            "subscribe_url": reverse("subscriptions:manage"),
            "current_user_id": request.user.id,
        },
    )


@login_required
@require_POST
@csrf_protect
def start_play(request):
    """
    Issue a one-time, expiring token for a game session.
    Client must send this token back with the final POST to update moogles.
    """
    try:
        data = json.loads(request.body.decode("utf-8") or "{}")
        game = str(data.get("game", "")).strip().lower()
        if not game:
            return JsonResponse({"error": "Missing 'game'."}, status=400)

        # gate only if not in FREE_GAMES
        if game not in FREE_GAMES and not user_has_active_subscription(request.user):
            return JsonResponse({"error": "Subscription required."}, status=403)

        # create DB token
        now = timezone.now()
        token = PlayToken.objects.create(
            user=request.user,
            game=game,
            max_award=min(GLOBAL_MAX_AWARD, int(data.get("max_award", GLOBAL_MAX_AWARD)) or GLOBAL_MAX_AWARD),
            expires_at=now + timedelta(seconds=TOKEN_MAX_AGE),
        )

        # sign token id + user id + game for tamper protection + timestamp
        signer = TimestampSigner(salt="letsplay.playtoken")
        payload = f"{token.id}:{request.user.id}:{game}:{token.max_award}"
        signed = signer.sign(payload)  # looks like "<payload>:<sig>"

        return JsonResponse({
            "play_token": signed,
            "expires_in": TOKEN_MAX_AGE,
            "max_award": token.max_award,
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@login_required
@require_POST
@csrf_protect
def update_moogles(request):
    try:
        data = json.loads(request.body.decode("utf-8") or "{}")
    except Exception:
        return JsonResponse({"error": "Invalid JSON."}, status=400)


    score_raw = data.get("score", 0)
    play_token_signed = data.get("play_token", "")
    if not play_token_signed:
        return JsonResponse({"error": "Missing play_token."}, status=400)

    try:
        score_int = int(score_raw)
    except (ValueError, TypeError):
        return JsonResponse({"error": "Invalid score."}, status=400)

    award = max(0, min(score_int, GLOBAL_MAX_AWARD))

    # Verify signature
    signer = TimestampSigner(salt="letsplay.playtoken")
    try:
        payload = signer.unsign(play_token_signed, max_age=TOKEN_MAX_AGE)
        # "<uuid>:<user_id>:<game>:<max_award>"
        token_id_str, user_id_str, game_key, token_max_award_str = payload.split(":", 3)
    except SignatureExpired:
        return JsonResponse({"error": "Token expired."}, status=400)
    except BadSignature:
        return JsonResponse({"error": "Invalid token signature."}, status=400)
    except Exception:
        return JsonResponse({"error": "Malformed token."}, status=400)
    # gate only non-free games
    if game_key not in FREE_GAMES and not user_has_active_subscription(request.user):
        return JsonResponse({"error": "Subscription required."}, status=403)
    now = timezone.now()

    with transaction.atomic():
        # Lock the token row
        try:
            token = PlayToken.objects.select_for_update().get(pk=token_id_str)
        except PlayToken.DoesNotExist:
            return JsonResponse({"error": "Unknown token."}, status=400)

        # Ownership & game
        if token.user_id != request.user.id or token.game != game_key:
            return JsonResponse({"error": "Token does not belong to this user/game."}, status=403)

        # DB-level expiry & single-use
        if token.expires_at <= now:
            return JsonResponse({"error": "Token already expired."}, status=400)
        if token.used_at is not None:
            return JsonResponse({"error": "Token already used."}, status=400)

        # Respect token’s own cap as well as global clamp
        try:
            token_cap_from_sig = int(token_max_award_str)
        except (ValueError, TypeError):
            token_cap_from_sig = token.max_award
        award = min(award, token.max_award, token_cap_from_sig)

        # Lock the profile row
        profile, _ = Profile.objects.select_for_update().get_or_create(user=request.user)

        # Cooldown check (5 minutes)
        if profile.last_moogles_award_at and (now - profile.last_moogles_award_at) < AWARD_COOLDOWN:
            retry_after = int((AWARD_COOLDOWN - (now - profile.last_moogles_award_at)).total_seconds())
            res = JsonResponse({"error": "Too many requests. Try later."}, status=429)
            res["Retry-After"] = str(max(retry_after, 1))
            return res

        # Atomic increment and cooldown stamp
        Profile.objects.filter(user=request.user).update(
            moogles=F("moogles") + award,
            last_moogles_award_at=now,
        )

        # Mark token used
        token.used_at = now
        token.save(update_fields=["used_at"])

    try:
        ip = request.META.get("REMOTE_ADDR")
        ua = request.META.get("HTTP_USER_AGENT", "")
        MoogleAward.objects.create(
            user=request.user,
            game=token.game,
            amount=award,
            ip=ip,
            user_agent=ua[:1024],
        )
    except Exception:
        pass

    new_total = Profile.objects.get(user=request.user).moogles
    return JsonResponse({"new_total": new_total})
