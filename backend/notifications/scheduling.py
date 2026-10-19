"""
When reminders and cancellation notices go out (docs/MILESTONE_4.md).

A reminder row is made for every "I'm going", whatever the member's
settings; the settings are checked when it's time to send. So turning
reminders on later still covers events they already said yes to.
"""

from datetime import datetime, time, timedelta

from django.db import transaction
from django.utils import timezone

from . import config
from .models import ScheduledNotification
from .sending import send_notification

REMINDER = ScheduledNotification.Kind.REMINDER
CANCELLED = ScheduledNotification.Kind.CANCELLED


def reminder_time(event):
    """5:00 PM Denver time on the day before the event starts."""
    day_before = timezone.localtime(event.starts_at).date() - timedelta(days=1)
    return timezone.make_aware(datetime.combine(day_before, time(config.REMINDER_HOUR)), timezone.get_current_timezone())


def schedule_reminder(user, event, now=None):
    """On "I'm going". None if 5 PM the day before has already passed."""
    send_at = reminder_time(event)
    if send_at <= (now or timezone.now()):
        return None
    reminder, _ = ScheduledNotification.objects.get_or_create(
        user=user, event=event, kind=REMINDER, defaults={"send_at": send_at}
    )
    return reminder


def unschedule_reminder(user, event):
    """On "I'm going" off: the reminder is removed (if not sent yet)."""
    ScheduledNotification.objects.filter(user=user, event=event, kind=REMINDER, sent_at__isnull=True).delete()


def event_time_changed(event, now=None):
    """
    The organizer moved the event: unsent reminders move with it. If the new
    reminder time has already passed, they're dropped. A reminder that was
    already sent isn't sent again.
    """
    from events.models import Going

    now = now or timezone.now()
    pending = ScheduledNotification.objects.filter(event=event, kind=REMINDER, sent_at__isnull=True)
    send_at = reminder_time(event)
    if send_at <= now:
        pending.delete()
        return
    pending.update(send_at=send_at)
    # Members who said yes when it was too late for a reminder (or whose
    # reminder was dropped by an earlier move) get one now that there's time.
    for going in Going.objects.filter(event=event).select_related("user"):
        schedule_reminder(going.user, event, now)


def event_cancelled(event, now=None):
    """
    Everyone going gets one cancellation notice, right away. If Expo can't
    be reached now, send_due_notifications tries again on its next run.
    Unsent reminders for the event are dropped.
    """
    from events.models import Going

    now = now or timezone.now()
    with transaction.atomic():
        ScheduledNotification.objects.filter(event=event, kind=REMINDER, sent_at__isnull=True).delete()
        notices = []
        for going in Going.objects.filter(event=event).select_related("user"):
            notice, created = ScheduledNotification.objects.get_or_create(
                user=going.user, event=event, kind=CANCELLED, defaults={"send_at": now}
            )
            if created:
                notices.append(notice)
    for notice in notices:
        send_notification(notice, now)


def schedule_upcoming_reminders(now=None):
    """Reminder rows for every upcoming "I'm going" that has none (used once, when this ships)."""
    from events.models import Event, Going

    now = now or timezone.now()
    made = 0
    for going in Going.objects.filter(event__status=Event.Status.ACTIVE, event__starts_at__gt=now).select_related("event"):
        if schedule_reminder(going.user, going.event, now):
            made += 1
    return made
