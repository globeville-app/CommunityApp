from django.contrib import admin
from django.contrib.admin.views.decorators import staff_member_required
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.urls import path, reverse
from django.utils.html import format_html

from .models import ProblemReport


@admin.register(ProblemReport)
class ProblemReportAdmin(admin.ModelAdmin):
    list_display = ("created_at", "status", "short_message", "language", "app_version", "screen", "user")
    list_filter = ("status", "language", "app_version")
    ordering = ("-created_at",)
    search_fields = ("message",)
    # Staff change only the status and their notes; everything else is what
    # the person sent.
    fields = (
        "status",
        "team_notes",
        "message",
        "screenshot_link",
        "user",
        "contact_email",
        "app_version",
        "os",
        "device_model",
        "language",
        "screen",
        "created_at",
    )
    readonly_fields = tuple(f for f in fields if f not in ("status", "team_notes"))

    @admin.display(description="Message")
    def short_message(self, report):
        return report.message[:80]

    @admin.display(description="Screenshot")
    def screenshot_link(self, report):
        if not report.screenshot:
            return "-"
        url = reverse("admin:support_problemreport_screenshot", args=[report.pk])
        return format_html('<a href="{0}" target="_blank"><img src="{0}" style="max-width:320px"></a>', url)

    def get_urls(self):
        # Screenshots are only ever served here, to signed-in staff.
        view = staff_member_required(self.screenshot_view)
        custom = [path("<int:pk>/screenshot/", view, name="support_problemreport_screenshot")]
        return custom + super().get_urls()

    def screenshot_view(self, request, pk):
        report = get_object_or_404(ProblemReport, pk=pk)
        if not report.screenshot:
            raise Http404
        return FileResponse(report.screenshot.open("rb"))
