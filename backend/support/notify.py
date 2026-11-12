"""The short emails the team gets: problem reports, other reports and organization requests."""

import logging

from django.conf import settings
from django.core.mail import send_mail
from django.urls import reverse

logger = logging.getLogger(__name__)


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


def team_recipients():
    """Who hears about reports and requests: the owner alerts list, else the problem-report list."""
    return settings.OWNER_ALERT_EMAILS or settings.PROBLEM_REPORT_EMAILS


def alert_team(request, subject, lines, admin_view, pk):
    """
    A short email to the team for something waiting in the admin: a report
    about an event, member or organization, or an organization request.
    Never fails the member's request: what they sent is already saved.
    """
    recipients = team_recipients()
    if not recipients:
        return  # nobody configured yet; it's still in the admin
    try:
        admin_link = request.build_absolute_uri(reverse(f"admin:{admin_view}_change", args=[pk]))
        send_mail(
            subject=f"{settings.APP_NAME}: {subject}",
            message="\n".join([*lines, "", f"Open in admin: {admin_link}"]),
            from_email=None,  # DEFAULT_FROM_EMAIL
            recipient_list=recipients,
        )
    except Exception as error:
        logger.error("Team alert email failed with %s", type(error).__name__)


def preview(text, limit=200):
    text = str(text or "")
    return text[:limit] + ("…" if len(text) > limit else "")
