from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from core.models import Profile  # ← Add this line
import json

@login_required
def lets_play_view(request):
    return render(request, 'lets_play/lets_play.html')

@csrf_exempt
@login_required
def update_moogles(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            score = int(data.get('score', 0))  # Your JS sends 'score'

            # ✅ SAFE: Get or create profile in case it's missing
            profile, _ = Profile.objects.get_or_create(user=request.user)
            profile.moogles += score
            profile.save()

            return JsonResponse({'new_total': profile.moogles})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    return JsonResponse({'error': 'Invalid request'}, status=400)