"""
When an event starts and ends, in one place (docs/BADGES.md, Step 1 rule 6).

An event with no end time ends at midnight: the start of the next day,
Denver time. An event on Oct 31 with no end time ends at 00:00 on Nov 1.
"""

from datetime import datetime, time, timedelta

from django.utils import timezone


def event_end(event):
    if event.ends_at:
        return event.ends_at
    local_start = timezone.localtime(event.starts_at)
    next_day = local_start.date() + timedelta(days=1)
    return timezone.make_aware(datetime.combine(next_day, time.min), timezone.get_current_timezone())


def has_ended(event, now=None):
    return event_end(event) <= (now or timezone.now())
