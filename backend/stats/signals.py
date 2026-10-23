"""
Invite links, guests and texting (docs/MILESTONE_5.md, "Admin"), and the
five value signals (docs/GO_LIVE.md §4): are people using the app for things
Partiful and group chats don't do? Counts and percentages only, never who.

Each signal is worked out for the last 30 days and since launch. A signal
with nothing to count yet shows "not yet tracked".
"""

from datetime import timedelta

from django.conf import settings
from django.db.models import Min, Q, Sum

from accounts.models import Account
from badges.models import Attendance
from events.models import Event, Going
from guests.models import ACTIVE_RSVP, Guest, GuestRSVP, PendingAttendance
from texting.models import ScheduledText
from texting.sending import month_start, spent_this_month
from web.models import DailyCount

FOUND = [Going.Source.CALENDAR, Going.Source.FOR_YOU, Going.Source.FOLLOWING, Going.Source.ORG_PAGE]
INVITED = [Going.Source.INVITE_LINK, Going.Source.SHARE_CARD]
CAME_BACK_WITHIN = timedelta(days=60)


def _pct(part, whole):
    """A whole-number percentage, or None ("not yet tracked") when there's nothing to count."""
    return round(100 * part / whole) if whole else None


def _since(field, since):
    return {f"{field}__gte": since} if since else {}


def conversion(since=None):
    """Guests who joined (claimed) ÷ guests whose events ended."""
    ended = PendingAttendance.objects.filter(**_since("rsvp__event__starts_at", since))
    joined = ended.filter(claimed_at__isnull=False).count()
    return {"joined": joined, "of": ended.count(), "pct": _pct(joined, ended.count())}


def value_signals(since, now):
    # 1. Events posted here first, not just copies of a Partiful invite.
    events = Event.objects.filter(**_since("created_at", since))
    no_partiful = _pct(events.filter(partiful_url="").count(), events.count())

    # 2. Found in the app vs. invited (guest RSVPs always came from an invite link).
    goings = Going.objects.filter(**_since("created_at", since))
    found = goings.filter(source__in=FOUND).count()
    invited = goings.filter(source__in=INVITED).count() + GuestRSVP.objects.filter(**_since("created_at", since)).count()
    found_pct = _pct(found, found + invited)

    # 3. Activity in Spanish: active members, and guest RSVPs.
    active = Account.objects.filter(user__is_staff=False, last_seen_at__isnull=False, **_since("last_seen_at", since))
    spanish_members = _pct(active.filter(language="es").count(), active.count())
    rsvps = GuestRSVP.objects.filter(**_since("created_at", since))
    spanish_guests = _pct(rsvps.filter(guest__language="es").count(), rsvps.count())

    # 4. Came back: first counted attendance in the period, and another within 60 days.
    counted = Attendance.objects.exclude(event__status=Event.Status.CANCELLED)
    firsts = counted.values("user").annotate(first=Min("event__starts_at"))
    if since:
        firsts = firsts.filter(first__gte=since)
    first_timers = list(firsts)
    came_back = sum(
        1
        for row in first_timers
        if counted.filter(
            user=row["user"], event__starts_at__gt=row["first"], event__starts_at__lte=row["first"] + CAME_BACK_WITHIN
        ).exists()
    )

    return {
        "no_partiful_pct": no_partiful,
        "found_pct": found_pct,
        "spanish_members_pct": spanish_members,
        "spanish_guests_pct": spanish_guests,
        "came_back_pct": _pct(came_back, len(first_timers)),
        "conversion": conversion(since),
    }


def invite_numbers(now):
    """Invite links, guests and texting, last 30 days."""
    since = now - timedelta(days=30)
    counts = DailyCount.objects.filter(day__gte=since.date())
    rsvps = GuestRSVP.objects.filter(created_at__gte=since)
    sent = ScheduledText.objects.filter(sent_at__gte=since, skipped_reason="")
    by_kind = {kind: sent.filter(kind=kind).count() for kind in ScheduledText.Kind.values}
    spent = spent_this_month(now)
    budget = settings.SMS_MONTHLY_BUDGET_USD
    return {
        "invite_shares": counts.filter(key="invite_share").aggregate(n=Sum("count"))["n"] or 0,
        "web_page_views": counts.filter(key="web_page_view").aggregate(n=Sum("count"))["n"] or 0,
        "guest_rsvps": rsvps.count(),
        "collect_opt_ins": rsvps.filter(wants_collect_text=True).count(),
        "collect_texts_sent": by_kind["collect"],
        "guests_joined": PendingAttendance.objects.filter(claimed_at__gte=since).count(),
        "opt_outs": Guest.objects.filter(opted_out_at__gte=since).count(),
        "texts_by_kind": by_kind,
        "spent_usd": round(spent, 2),
        "budget_usd": budget,
        "budget_pct": _pct(spent, budget),
        "month_start": month_start(now),
        "going_guests_now": GuestRSVP.objects.filter(ACTIVE_RSVP, event__starts_at__gte=now).count(),
    }


def signal_numbers(now):
    return {"last_30": value_signals(now - timedelta(days=30), now), "since_launch": value_signals(None, now)}
