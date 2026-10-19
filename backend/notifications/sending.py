"""
Sending what's due. Safe to run twice at once: each notification is
"claimed" with one database update before it's sent, so only one run sends it.
"""

from django.utils import timezone

from .models import ScheduledNotification
from .push import PushUnavailable, send_to_user
from .texts import push_text


def should_deliver(notification):
    """Whether the member still wants this one, and it still makes sense."""
    from events.models import Event, Going
    from profiles.models import Profile

    profile = Profile.objects.filter(user=notification.user).first()
    if profile is None:
        return False
    event = notification.event
    if notification.kind == ScheduledNotification.Kind.REMINDER:
        return (
            profile.reminders_enabled
            and event.status == Event.Status.ACTIVE
            and Going.objects.filter(user=notification.user, event=event).exists()
        )
    return profile.cancellation_alerts_enabled


def send_notification(notification, now=None):
    """Claim it, then push it. Returns True if a push went out."""
    now = now or timezone.now()
    claimed = ScheduledNotification.objects.filter(pk=notification.pk, sent_at__isnull=True).update(sent_at=now)
    if not claimed:
        return False  # another run already has it
    notification.refresh_from_db()
    if not should_deliver(notification):
        return False
    body = push_text(notification.kind, notification.event, notification.user)
    try:
        delivered = send_to_user(notification.user, body, {"event_id": notification.event_id})
    except PushUnavailable:
        # Give it back, so the next run tries again.
        ScheduledNotification.objects.filter(pk=notification.pk).update(sent_at=None)
        return False
    if delivered:
        ScheduledNotification.objects.filter(pk=notification.pk).update(delivered=True)
    return delivered


def send_due_notifications(now=None):
    """Send everything whose time has come. Returns how many pushes went out."""
    now = now or timezone.now()
    due = ScheduledNotification.objects.filter(sent_at__isnull=True, send_at__lte=now).select_related("event", "user")
    return sum(1 for notification in due.order_by("send_at", "pk") if send_notification(notification, now))
