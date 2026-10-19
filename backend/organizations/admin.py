"""
The team's side of organizations (docs/MILESTONE_4.md, Admin):
  - the approval queue: pending organizations and change requests, with
    Approve and Reject (a reason is required to reject)
  - assigning an admin to a hidden organization (add a row under Admins,
    then use "Approve" to show it again)
"""

from django.contrib import admin, messages
from django.utils import timezone

from .models import (
    BUSINESS_RULE,
    Follow,
    Organization,
    OrganizationAdmin,
    OrganizationChangeRequest,
    OrganizationNeighborhood,
    OrganizationReport,
)


class NeighborhoodsInline(admin.TabularInline):
    model = OrganizationNeighborhood
    extra = 0
    autocomplete_fields = ["neighborhood"]


class AdminsInline(admin.TabularInline):
    model = OrganizationAdmin
    extra = 0
    raw_id_fields = ["user"]
    readonly_fields = ["added_at"]
    verbose_name = "admin (a member)"


@admin.register(Organization)
class OrganizationModelAdmin(admin.ModelAdmin):
    list_display = ("name", "type", "status", "admin_count", "created_at")
    list_filter = ("status", "type")
    search_fields = ("name",)
    inlines = [NeighborhoodsInline, AdminsInline]
    readonly_fields = ("business_rule", "created_at", "updated_at")
    fields = (
        "name",
        "type",
        "business_rule",
        "status",
        "rejection_reason",
        "description",
        "description_alt",
        "language",
        "link",
        "photo",
        "created_at",
        "updated_at",
    )
    actions = ["approve", "reject"]

    @admin.display(description="Rule for businesses")
    def business_rule(self, obj):
        return BUSINESS_RULE

    @admin.display(description="Admins")
    def admin_count(self, obj):
        return obj.admins.count()

    @admin.action(description="Approve (goes live / shows again)")
    def approve(self, request, queryset):
        for organization in queryset:
            if not organization.admins.exists():
                self.message_user(request, f"{organization}: assign an admin first.", messages.ERROR)
                continue
            organization.status = Organization.Status.APPROVED
            organization.save(update_fields=["status", "updated_at"])
            self.message_user(request, f"{organization} is live.")

    @admin.action(description="Reject (fill in the rejection reason first)")
    def reject(self, request, queryset):
        for organization in queryset:
            if not organization.rejection_reason.strip():
                self.message_user(request, f"{organization}: write a rejection reason first.", messages.ERROR)
                continue
            organization.status = Organization.Status.REJECTED
            organization.save(update_fields=["status", "updated_at"])


@admin.register(OrganizationChangeRequest)
class ChangeRequestAdmin(admin.ModelAdmin):
    list_display = ("organization", "proposed", "status", "created_at")
    list_filter = ("status",)
    readonly_fields = ("organization", "requested_by", "name", "type", "neighborhood_ids", "created_at", "decided_at")
    fields = readonly_fields[:5] + ("status", "rejection_reason", "created_at", "decided_at")
    actions = ["approve", "reject"]

    @admin.display(description="Proposed changes")
    def proposed(self, obj):
        from neighborhoods.models import Neighborhood

        parts = []
        if obj.name:
            parts.append(f"name → {obj.name}")
        if obj.type:
            parts.append(f"type → {obj.type}")
        if obj.neighborhood_ids:
            names = Neighborhood.objects.filter(pk__in=obj.neighborhood_ids).values_list("name", flat=True)
            parts.append(f"neighborhoods → {', '.join(names)}")
        return "; ".join(parts)

    @admin.action(description="Approve (apply the changes)")
    def approve(self, request, queryset):
        for change in queryset.filter(status=OrganizationChangeRequest.Status.PENDING):
            apply_change(change)
            self.message_user(request, f"{change.organization} updated.")

    @admin.action(description="Reject (fill in the rejection reason first)")
    def reject(self, request, queryset):
        for change in queryset.filter(status=OrganizationChangeRequest.Status.PENDING):
            if not change.rejection_reason.strip():
                self.message_user(request, f"{change}: write a rejection reason first.", messages.ERROR)
                continue
            change.status = OrganizationChangeRequest.Status.REJECTED
            change.decided_at = timezone.now()
            change.save(update_fields=["status", "decided_at"])


def apply_change(change):
    """Approve a change request: the new name, type and/or neighborhoods take effect."""
    organization = change.organization
    if change.name:
        organization.name = change.name
    if change.type:
        organization.type = change.type
    organization.save()
    if change.neighborhood_ids:
        organization.neighborhoods.set(change.neighborhood_ids)
    change.status = OrganizationChangeRequest.Status.APPROVED
    change.decided_at = timezone.now()
    change.save(update_fields=["status", "decided_at"])


@admin.register(OrganizationReport)
class OrganizationReportAdmin(admin.ModelAdmin):
    list_display = ("created_at", "organization", "reason", "reporter")
    ordering = ("-created_at",)
    readonly_fields = ("organization", "reporter", "reason", "created_at")


@admin.register(Follow)
class FollowAdmin(admin.ModelAdmin):
    # Counts only in practice; the list exists for support questions.
    list_display = ("organization", "created_at")
    list_filter = ("organization",)

    def has_add_permission(self, request):
        return False
