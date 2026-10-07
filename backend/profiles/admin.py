from django.contrib import admin

from .models import Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("display_name", "user", "neighborhood", "alias", "joined_at")
    list_filter = ("neighborhood",)
