from django.contrib import admin

from django.urls import reverse
from django.utils.html import format_html

from .models import MemberReport, Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("display_name", "user", "neighborhood", "alias", "joined_at")
    list_filter = ("neighborhood",)


@admin.register(MemberReport)
class MemberReportAdmin(admin.ModelAdmin):
    """Reports about members (name, photo, behavior). Open the member to edit their profile or delete them."""

    list_display = ("created_at", "reported_member", "reason")
    ordering = ("-created_at",)
    fields = ("reported_member", "reason", "created_at")
    readonly_fields = ("reported_member", "reason", "created_at")

    @admin.display(description="Reported member")
    def reported_member(self, report):
        profile = getattr(report.reported, "profile", None)
        if profile is None:
            return "(no profile)"
        url = reverse("admin:profiles_profile_change", args=[profile.pk])
        return format_html('<a href="{}">{}</a>', url, profile.display_name)

    def has_add_permission(self, request):
        return False
