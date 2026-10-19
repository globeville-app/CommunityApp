from django.contrib import admin

from .models import Event, EventReport


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    # "organizer" is who posted it, also for organization events (team only).
    list_display = ("title", "category", "neighborhood", "starts_at", "status", "organization", "organizer")
    list_filter = ("status", "category", "neighborhood")
    raw_id_fields = ("organization",)
    search_fields = ("title",)


@admin.register(EventReport)
class EventReportAdmin(admin.ModelAdmin):
    list_display = ("created_at", "event", "reason", "reporter")
    ordering = ("-created_at",)
    readonly_fields = ("event", "reporter", "reason", "created_at")
