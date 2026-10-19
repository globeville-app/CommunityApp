"""Reminders for "I'm going" taps made before notifications existed."""

from django.db import migrations


def backfill(apps, schema_editor):
    from datetime import datetime, time, timedelta

    from django.utils import timezone

    from notifications import config

    Going = apps.get_model("events", "Going")
    ScheduledNotification = apps.get_model("notifications", "ScheduledNotification")
    now = timezone.now()
    tz = timezone.get_current_timezone()
    for going in Going.objects.filter(event__status="active", event__starts_at__gt=now).select_related("event"):
        day_before = timezone.localtime(going.event.starts_at, tz).date() - timedelta(days=1)
        send_at = timezone.make_aware(datetime.combine(day_before, time(config.REMINDER_HOUR)), tz)
        if send_at > now:
            ScheduledNotification.objects.get_or_create(
                user_id=going.user_id, event_id=going.event_id, kind="reminder", defaults={"send_at": send_at}
            )


class Migration(migrations.Migration):
    dependencies = [("notifications", "0001_initial"), ("events", "0002_event_counted_hosted_at_event_is_hosts_first_counted_and_more")]

    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
