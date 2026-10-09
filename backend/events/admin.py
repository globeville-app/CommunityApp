from django.contrib import admin

from .models import Event, EventReport


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "neighborhood", "starts_at", "status", "organizer")
    list_filter = ("status", "category", "neighborhood")
    search_fields = ("title",)


@admin.register(EventReport)
class EventReportAdmin(admin.ModelAdmin):
    list_display = ("created_at", "event", "reason", "reporter")
    ordering = ("-created_at",)
    readonly_fields = ("event", "reporter", "reason", "created_at")
