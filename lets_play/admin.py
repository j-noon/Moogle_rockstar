from django.contrib import admin
from .models import PlayToken, MoogleAward

@admin.register(PlayToken)
class PlayTokenAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "game", "issued_at", "expires_at", "used_at", "max_award")
    list_filter = ("game", "used_at")
    search_fields = ("id", "user__username")

@admin.register(MoogleAward)
class MoogleAwardAdmin(admin.ModelAdmin):
    list_display = ("user", "game", "amount", "created_at")
    list_filter = ("game",)
    search_fields = ("user__username",)