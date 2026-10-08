"""The short email the team gets for each new problem report."""

from django.conf import settings
from django.core.mail import send_mail
from django.urls import reverse


def email_team(report, request):
    recipients = settings.PROBLEM_REPORT_EMAILS
    if not recipients:
        return  # nobody configured yet; the report is still in the admin

    admin_link = request.build_absolute_uri(reverse("admin:support_problemreport_change", args=[report.pk]))
    preview = report.message[:200] + ("…" if len(report.message) > 200 else "")
    body = "\n".join(
        [
            preview,
            "",
            f"Version: {report.app_version or '-'}",
            f"Device: {report.device_model or '-'} ({report.os or '-'})",
            f"Language: {report.language or '-'}",
            f"Screen: {report.screen or '-'}",
            f"Signed in: {'yes' if report.user_id else 'no'}",
            "",
            f"Open in admin: {admin_link}",
        ]
    )
    # The screenshot is never attached; the team views it in the admin.
    send_mail(
        subject=f"{settings.APP_NAME} problem report #{report.pk}",
        message=body,
        from_email=None,  # DEFAULT_FROM_EMAIL
        recipient_list=recipients,
    )
