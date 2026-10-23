"""
Guests in Django admin (docs/MILESTONE_5.md, "Admin"). The team can find a
guest by the last 4 digits of their number, block or unblock the number,
and read (never change) the consent records. The full number is never
shown.
"""

from django.contrib import admin
from django.utils import timezone

from .models import Guest, GuestConsent


class ConsentsInline(admin.TabularInline):
    model = GuestConsent
    extra = 0
    can_delete = False
    fields = readonly_fields = ("kind", "consent_version", "language", "created_at")

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(Guest)
class GuestAdmin(admin.ModelAdmin):
    list_display = ("first_name", "number", "language", "created_at", "opted_out_at", "blocked_at")
    list_filter = ("language",)
    fields = readonly_fields = ("first_name", "number", "language", "phone_verified_at", "opted_out_at", "blocked_at", "created_at")
    inlines = [ConsentsInline]
    actions = ["block", "unblock"]
    search_fields = ("phone",)
    search_help_text = "The last 4 digits of the number."

    @admin.display(description="Number")
    def number(self, guest):
        return f"…{guest.phone_last4}"

    def get_search_results(self, request, queryset, search_term):
        # Only the last 4 digits, so the team never types or sees a full number.
        term = search_term.strip()
        if not term:
            return queryset, False
        if len(term) != 4 or not term.isdigit():
            return queryset.none(), False
        return queryset.filter(phone__endswith=term), False

    def has_add_permission(self, request):
        return False

    @admin.action(description="Block these numbers (no RSVPs, no texts)")
    def block(self, request, queryset):
        queryset.update(blocked_at=timezone.now())

    @admin.action(description="Unblock these numbers")
    def unblock(self, request, queryset):
        queryset.update(blocked_at=None)
