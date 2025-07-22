from django.shortcuts import render
from django.contrib.auth.decorators import login_required

@login_required
def merchandise_view(request):
    return render(request, 'merchandise/merchandise.html')
