"""
Guests collecting their badge after joining (docs/MILESTONE_5.md, "Joining
and badges"; Changes Milestone 3).

When the event ends, each standing guest RSVP becomes PendingAttendance with
a link token and a short code. A guest who joins within the 7-day collect
window claims it, and the attendance is recorded for their new account like
a collect, so their badges grow. Until then they don't count toward the
host's 2-attendee rule.
"""

from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework import status

from badges import config as badge_config
from config.errors import ApiError

from .models import ACTIVE_RSVP, GuestRSVP, PendingAttendance


def pending_for(rsvp):
    """The RSVP's pending attendance, made if needed (expires 7 days after the event)."""
    from events.timing import event_end

    pending, _ = PendingAttendance.objects.get_or_create(
        rsvp=rsvp, defaults={"expires_at": event_end(rsvp.event) + timedelta(days=badge_config.COLLECT_WINDOW_DAYS)}
    )
    return pending


def make_pending_for_ended_events(now=None):
    """Run by the 15-minute job: every standing RSVP of an event that ended gets its claim."""
    from events.models import Event
    from events.timing import event_end, has_ended

    now = now or timezone.now()
    rsvps = (
        GuestRSVP.objects.filter(ACTIVE_RSVP, pending__isnull=True, event__status=Event.Status.ACTIVE)
        .filter(event__starts_at__lte=now)
        .select_related("event")
    )
    made = 0
    for rsvp in rsvps:
        window_closes = event_end(rsvp.event) + timedelta(days=badge_config.COLLECT_WINDOW_DAYS)
        if has_ended(rsvp.event, now) and now <= window_closes:
            pending_for(rsvp)
            made += 1
    return made


def claim(user, *, token=None, code=None, now=None):
    """
    Turn a guest's pending attendance into a collect for this member.
    Returns their new celebrations. Errors: claim_not_found, claim_used,
    claim_expired, and whatever record_attendance refuses (e.g. is_host).
    """
    from badges import engine
    from badges.models import Attendance
    from events.models import Going

    now = now or timezone.now()
    with transaction.atomic():
        query = PendingAttendance.objects.select_for_update().select_related("rsvp__event")
        if token:
            pending = query.filter(claim_token=str(token)).first()
        elif code:
            pending = query.filter(claim_code=str(code).strip().upper()).first()
        else:
            pending = None
        if pending is None:
            raise ApiError("claim_not_found", status_code=status.HTTP_404_NOT_FOUND)
        if pending.claimed_at is not None:
            raise ApiError("claim_used", status_code=status.HTTP_409_CONFLICT)
        if now > pending.expires_at or not pending.rsvp.is_active:
            raise ApiError("claim_expired", status_code=status.HTTP_410_GONE)
        event = pending.rsvp.event
        if Attendance.objects.filter(user=user, event=event).exists():
            raise ApiError("already_recorded", status_code=status.HTTP_409_CONFLICT)
        # The guest's RSVP stands in for "I'm going" in record_attendance's checks.
        Going.objects.get_or_create(user=user, event=event, defaults={"source": "invite_link"})
        celebrations = engine.record_attendance(user, event, "collect", now=now)
        pending.claimed_by = user
        pending.claimed_at = now
        pending.save(update_fields=["claimed_by", "claimed_at"])
    return celebrations
