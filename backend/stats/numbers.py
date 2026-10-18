"""
The owner stats page's numbers (docs/GO_LIVE.md §4). Counts only: no names,
emails or photos ever leave this module. Computed from the database each
time the page loads.

"Members" are non-staff accounts, counted from signup on (some may still be
part-way through joining).
"""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.utils import timezone

from accounts.models import Account
from events.categories import GROUPS
from events.models import Event, Going
from profiles.models import Profile
from badges.community import known_for
from badges.models import Attendance, Celebration, DeclineLog, ShareLog
from support.models import ProblemReport


def _days_ago(now, days):
    return now - timedelta(days=days)


def start_of_today(now):
    """Midnight today, Denver time (settings.TIME_ZONE)."""
    return timezone.localtime(now).replace(hour=0, minute=0, second=0, microsecond=0)


def member_numbers(now):
    members = get_user_model().objects.filter(is_staff=False)
    accounts = Account.objects.filter(user__is_staff=False)
    profiles = Profile.objects.filter(user__is_staff=False)

    # Daily signups for the last 30 days, oldest first, including empty days.
    since = start_of_today(now) - timedelta(days=29)
    per_day = dict(
        members.filter(date_joined__gte=since)
        .annotate(day=TruncDate("date_joined", tzinfo=timezone.get_current_timezone()))
        .values_list("day")
        .annotate(n=Count("id"))
        .values_list("day", "n")
    )
    daily = [(day, per_day.get(day, 0)) for day in ((since + timedelta(days=i)).date() for i in range(30))]
    busiest = max([n for _, n in daily] + [1])

    return {
        "total": members.count(),
        "new_today": members.filter(date_joined__gte=start_of_today(now)).count(),
        "new_7": members.filter(date_joined__gte=_days_ago(now, 7)).count(),
        "new_30": members.filter(date_joined__gte=_days_ago(now, 30)).count(),
        "active_7": accounts.filter(last_seen_at__gte=_days_ago(now, 7)).count(),
        "active_30": accounts.filter(last_seen_at__gte=_days_ago(now, 30)).count(),
        "by_neighborhood": list(
            profiles.values_list("neighborhood__name").annotate(n=Count("id")).order_by("-n", "neighborhood__name")
        ),
        "by_language": [
            ("English", accounts.filter(language="en").count()),
            ("Español", accounts.filter(language="es").count()),
        ],
        "daily_signups": [(day, n, round(100 * n / busiest)) for day, n in daily],
    }


def event_numbers(now):
    recent = Event.objects.filter(created_at__gte=_days_ago(now, 30))
    return {
        "posted_7": Event.objects.filter(created_at__gte=_days_ago(now, 7)).count(),
        "posted_30": recent.count(),
        "upcoming": Event.objects.filter(status=Event.Status.ACTIVE)
        .filter(Q(starts_at__gte=now) | Q(ends_at__gte=now))
        .count(),
        "by_group": [(group, recent.filter(category__in=keys).count()) for group, keys in GROUPS]
        + [("other", recent.filter(category="other").count())],
        "going_taps_7": Going.objects.filter(created_at__gte=_days_ago(now, 7)).count(),
        "organizers": Event.objects.exclude(organizer=None).values("organizer").distinct().count(),
    }


def badge_numbers(now):
    """Milestone 3: attendance and badges, last 30 days. Counts only."""
    since = _days_ago(now, 30)
    recent = Attendance.objects.filter(created_at__gte=since)
    celebrations = Celebration.objects.filter(created_at__gte=since)
    return {
        "attended_auto": recent.filter(method=Attendance.Method.AUTO).count(),
        "attended_collect": recent.filter(method=Attendance.Method.COLLECT).count(),
        "declines": DeclineLog.objects.filter(date__gte=since.date()).count(),
        "badges_earned": celebrations.filter(kind=Celebration.Kind.EARNED).count(),
        "stage_ups": celebrations.filter(kind=Celebration.Kind.STAGE_UP).count(),
        "shares": ShareLog.objects.filter(date__gte=since.date()).count(),
        "known_for": known_for(now),
    }


def support_numbers():
    return {"open_reports": ProblemReport.objects.exclude(status=ProblemReport.Status.RESOLVED).count()}


def all_numbers(now=None):
    now = now or timezone.now()
    return {
        "members": member_numbers(now),
        "events": event_numbers(now),
        "support": support_numbers(),
        "badges": badge_numbers(now),
        "generated_at": timezone.localtime(now),
    }
