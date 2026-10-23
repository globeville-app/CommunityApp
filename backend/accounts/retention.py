"""
How long things are kept (owner decision D3, review PLAN P26).

Kept for as long as the account exists, because participation history and
impact are built from them: the account and profile, attendance, badges and
keepsakes, follows and organization roles, and each event's title, category,
neighborhood, time and host. Deleting the account removes the member's part
straight away (accounts/deletion.py).

Guests who RSVP'd on the web (Milestone 5) are deleted, phone number and
all, 30 days after the last text about their events, unless they joined
or have another RSVP coming up.

Everything else is deleted once its job is done, by a daily job:
`python manage.py cleanup_old_data` (.do/app.yaml). Each rule below says
what goes and when; `--dry-run` only counts.
"""

from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

YEAR = timedelta(days=365)


def guests_done_with(now):
    """Guests whose last text was over 30 days ago, who didn't join and have nothing coming up."""
    from django.db.models import Max

    from guests.models import ACTIVE_RSVP, Guest, GuestRSVP

    upcoming = GuestRSVP.objects.filter(ACTIVE_RSVP, event__starts_at__gte=now - timedelta(days=1)).values("guest")
    return (
        Guest.objects.annotate(last_text=Max("texts__send_at"))
        .filter(last_text__lt=now - timedelta(days=30))
        .exclude(pk__in=upcoming)
        .exclude(rsvps__pending__claimed_at__isnull=False)
    )


def cleanup(now=None, dry_run=False):
    """Apply every rule. Returns {rule: how many rows it touched}."""
    from badges.models import Celebration
    from events.models import Event, EventReport, Going, TranslationCache
    from notifications.models import PushToken, ScheduledNotification
    from organizations.models import OrganizationChangeRequest, OrganizationReport
    from support.models import ProblemReport

    from .authentication import EXPIRES_AFTER
    from .models import DeviceToken, EmailCode

    now = now or timezone.now()
    year_ago = now - YEAR
    # Events that ended more than a year ago (no end time: the day it started).
    old_events = Event.objects.filter(Q(ends_at__lt=year_ago) | Q(ends_at__isnull=True, starts_at__lt=year_ago))

    rules = {
        # The meeting spot (it may be someone's porch) and descriptions of
        # events over a year ago. Title, time, place and host stay.
        "past event spots and descriptions": old_events.exclude(location_text="", description="", description_alt=""),
        "their cached translations": TranslationCache.objects.filter(event__in=old_events),
        '"I\'m going" taps': Going.objects.filter(event__in=old_events),
        "reminders sent": ScheduledNotification.objects.filter(sent_at__lt=now - timedelta(days=30)),
        "phone push tokens": PushToken.objects.filter(
            Q(last_used_at__lt=now - timedelta(days=90)) | Q(last_used_at__isnull=True, created_at__lt=now - timedelta(days=90))
        ),
        "celebrations already seen": Celebration.objects.filter(seen_at__lt=now - timedelta(days=90)),
        "event reports": EventReport.objects.filter(created_at__lt=year_ago),
        "organization reports": OrganizationReport.objects.filter(created_at__lt=year_ago),
        "decided organization changes": OrganizationChangeRequest.objects.filter(decided_at__lt=year_ago),
        "problem reports": ProblemReport.objects.filter(created_at__lt=year_ago),
        # Guests' phone numbers (Milestone 5): 30 days after the last text
        # about their events, unless they joined or have another RSVP coming.
        "guest phone numbers": guests_done_with(now),
        # Logins and codes that already stopped working.
        "expired logins": DeviceToken.objects.filter(last_used_at__lt=now - EXPIRES_AFTER),
        "expired email codes": EmailCode.objects.filter(expires_at__lt=now),
    }
    counts = {name: query.count() for name, query in rules.items()}
    if dry_run:
        return counts

    screenshots = []
    with transaction.atomic():
        for name, query in rules.items():
            if name == "past event spots and descriptions":
                query.update(location_text="", description="", description_alt="")
            elif name == "problem reports":
                screenshots = [(r.screenshot.storage, r.screenshot.name) for r in query if r.screenshot]
                query.delete()
            else:
                query.delete()
    # Screenshot files go once the rows are gone for good.
    for storage, name in screenshots:
        storage.delete(name)
    return counts
