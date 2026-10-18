"""
The badge engine (docs/MILESTONE_3.md). docs/BADGES.md is the source of
truth for every rule here.

The main entry point is record_attendance(user, event, method). Badges are
worked out at that moment, in one database transaction, for everyone the
attendance affects: the attendee, the host and, when it's the host's first
event to count, that event's other attendees (Day One). There are no
scheduled jobs: collect cards and impact numbers are computed on request.

Every count is recomputed from Attendance rows, so it's always correct. The
stored stage is the highest ever reached and is never lowered.
"""

from datetime import timedelta

from django.db import transaction
from django.db.models import Count, Exists, OuterRef
from django.utils import timezone
from rest_framework import status

from accounts.models import language_of
from config.errors import ApiError
from events.categories import GROUPS
from events.models import Event, Going
from events.timing import event_end, has_ended

from . import config
from .models import Attendance, BadgeState, Celebration, DeclineLog, Keepsake

GROUP_CATEGORIES = dict(GROUPS)
CONFLICT = status.HTTP_409_CONFLICT


# ---- What counts --------------------------------------------------------------------


def _live(queryset, prefix=""):
    """Leave out cancelled events: they never count (BADGES.md, Step 1 rule 3)."""
    return queryset.exclude(**{f"{prefix}status": Event.Status.CANCELLED})


def attendance_for_badges(user):
    """The member's own attendance that grows their badges (no sensitive categories)."""
    return (
        _live(Attendance.objects.filter(user=user), "event__")
        .exclude(event__category__in=config.SENSITIVE_CATEGORIES)
        .select_related("event")
    )


def counted_hosted_events(user):
    """Events the member organized that count as hosted (2+ counted attendees)."""
    return _live(Event.objects.filter(organizer=user, counted_hosted_at__isnull=False))


def _matches(rule, event):
    kind, _, value = rule.partition(":")
    if kind == "group":
        return event.category in GROUP_CATEGORIES[value]
    if kind == "category":
        return event.category == value
    return False


def _months_in_a_row(months, run=3):
    """True if the set of (year, month) has `run` calendar months in a row."""
    index = {year * 12 + month - 1 for year, month in months}
    return any(all(start + i in index for i in range(run)) for start in index)


def _season(month):
    # Dec-Feb, Mar-May, Jun-Aug, Sep-Nov
    return {12: 0, 1: 0, 2: 0, 3: 1, 4: 1, 5: 1, 6: 2, 7: 2, 8: 2}.get(month, 3)


def compute(user):
    """
    Returns ({growth badge: count}, {keepsakes earned}) from the data as it
    is right now.
    """
    attended = [a.event for a in attendance_for_badges(user)]
    attendances = list(attendance_for_badges(user))
    hosted = list(counted_hosted_events(user))

    counts = {}
    for key, _track, rule in config.GROWTH_BADGES:
        if rule == "any":
            counts[key] = len(attended)
        elif rule == "distinct_hosts":
            counts[key] = len({e.organizer_id for e in attended if e.organizer_id})
        elif rule == "hosts_first_event":
            counts[key] = sum(1 for e in attended if e.is_hosts_first_counted)
        elif rule == "neighbors_brought_together":
            counts[key] = (
                Attendance.objects.filter(event__in=hosted).exclude(user=user).values("user").distinct().count()
            )
        else:  # a group or category: attended or hosted
            counts[key] = sum(1 for e in attended if _matches(rule, e)) + sum(1 for e in hosted if _matches(rule, e))

    months = set()
    for event in attended:
        local = timezone.localtime(event.starts_at)
        months.add((local.year, local.month))
    keepsakes = set()
    if any(a.event.language != a.user_language_at_time for a in attendances):
        keepsakes.add("ambassador")
    if any(e.title_alt for e in hosted):  # written by the organizer, not machine-translated
        keepsakes.add("open_door")
    if _months_in_a_row(months):
        keepsakes.add("familiar_face")
    if len({_season(month) for _, month in months}) == 4:
        keepsakes.add("year_rounder")
    return counts, keepsakes


def update_badges(user, now=None):
    """Bring the member's badges up to date. Returns the new Celebration rows."""
    now = now or timezone.now()
    counts, keepsakes = compute(user)
    new = []
    for key in config.GROWTH_KEYS:
        state, _ = BadgeState.objects.get_or_create(user=user, badge_key=key)
        count = counts[key]
        reached = config.stage_for(key, count)
        if reached > state.stage:  # only ever up
            kind = Celebration.Kind.EARNED if state.stage == 0 else Celebration.Kind.STAGE_UP
            if state.stage == 0:
                state.earned_at = now
            state.stage = reached
            new.append(Celebration(user=user, badge_key=key, kind=kind, stage=reached, count=count))
        state.count = count
        if state.stage == len(config.STAGES):
            grove = config.thresholds(key)[-1]
            for i, multiple in enumerate(config.GROVE_MILESTONE_MULTIPLIERS):
                if i >= state.grove_milestones_celebrated and count >= multiple * grove:
                    state.grove_milestones_celebrated = i + 1
                    new.append(
                        Celebration(
                            user=user,
                            badge_key=key,
                            kind=Celebration.Kind.GROVE_MILESTONE,
                            stage=state.stage,
                            count=multiple * grove,
                        )
                    )
        state.save()
    for key in config.KEEPSAKES:
        if key in keepsakes:
            _, created = Keepsake.objects.get_or_create(user=user, badge_key=key)
            if created:
                new.append(Celebration(user=user, badge_key=key, kind=Celebration.Kind.EARNED))
    return Celebration.objects.bulk_create(new)


# ---- Recording attendance -----------------------------------------------------------


def record_attendance(user, event, method, now=None):
    """
    Record that `user` went to `event` ("auto" check-in or "collect"), then
    update every affected badge. Idempotent: a second call changes nothing
    (it answers already_recorded). Returns the attendee's new celebrations.
    """
    now = now or timezone.now()
    with transaction.atomic():
        event = Event.objects.select_for_update().get(pk=event.pk)
        if Attendance.objects.filter(user=user, event=event).exists():
            raise ApiError("already_recorded", status_code=CONFLICT)
        if event.status == Event.Status.CANCELLED:
            raise ApiError("event_cancelled", status_code=CONFLICT)
        if event.organizer_id == user.id:
            raise ApiError("is_host", status_code=CONFLICT)  # hosting counts separately
        if not Going.objects.filter(user=user, event=event).exists():
            raise ApiError("not_going", status_code=CONFLICT)

        end = event_end(event)
        if method == Attendance.Method.COLLECT:
            if now < end:
                raise ApiError("event_not_ended", status_code=CONFLICT)
            if now > end + timedelta(days=config.COLLECT_WINDOW_DAYS):
                raise ApiError("collect_window_closed", status_code=CONFLICT)
        else:
            if event.latitude is None:
                raise ApiError("pin_required", status_code=CONFLICT)
            opens = event.starts_at - timedelta(minutes=config.CHECKIN_EARLY_MINUTES)
            if not opens <= now <= end:
                raise ApiError("checkin_window_closed", status_code=CONFLICT)

        Attendance.objects.create(
            user=user,
            event=event,
            neighborhood_id=event.neighborhood_id,
            method=method,
            is_first_in_neighborhood=not Attendance.objects.filter(
                user=user, neighborhood_id=event.neighborhood_id
            ).exists(),
            user_language_at_time=language_of(user),
        )

        affected = {user}
        if event.organizer_id:
            attendees = Attendance.objects.filter(event=event).count()
            if event.counted_hosted_at is None and attendees >= config.HOSTED_MIN_ATTENDEES:
                # It counts as hosted from now on. Is it the host's first?
                first = not Event.objects.filter(
                    organizer_id=event.organizer_id, counted_hosted_at__isnull=False
                ).exists()
                event.counted_hosted_at = now
                event.is_hosts_first_counted = first
                event.save(update_fields=["counted_hosted_at", "is_hosts_first_counted"])
                if first:
                    # Day One goes to everyone who came, including earlier collectors.
                    affected.update(a.user for a in Attendance.objects.filter(event=event).select_related("user"))
            if event.counted_hosted_at is not None:
                affected.add(event.organizer)

        celebrations = {}
        for member in affected:
            celebrations[member.pk] = update_badges(member, now)
        return celebrations[user.pk]


def decline(user, event, now=None):
    """
    "I didn't make it": removes the member from the going count and their
    collect cards. Records nothing toward badges. Hosts never find out.
    """
    now = now or timezone.now()
    with transaction.atomic():
        if Attendance.objects.filter(user=user, event=event).exists():
            raise ApiError("already_recorded", status_code=CONFLICT)
        going = Going.objects.filter(user=user, event=event)
        if not going.exists():
            raise ApiError("not_going", status_code=CONFLICT)
        if not has_ended(event, now):
            raise ApiError("event_not_ended", status_code=CONFLICT)
        going.delete()
        DeclineLog.objects.create()


# ---- Collect cards, geofences and the re-offer -------------------------------------


def _going_events(user):
    return _live(Event.objects.filter(goings__user=user).exclude(organizer=user)).exclude(attendances__user=user)


def collect_events(user, now=None):
    """Past events the member is going to, ended less than 7 days ago, not yet collected."""
    now = now or timezone.now()
    window = timedelta(days=config.COLLECT_WINDOW_DAYS)
    candidates = _going_events(user).filter(starts_at__lte=now, starts_at__gte=now - window - timedelta(days=2))
    return sorted(
        (e for e in candidates if event_end(e) <= now <= event_end(e) + window),
        key=lambda e: event_end(e),
        reverse=True,
    )


def badges_an_event_grows(user, event, states):
    """
    The member's badges that collecting this event would grow, with where
    they stand now. Nothing for sensitive categories.
    """
    if event.category in config.SENSITIVE_CATEGORIES:
        return []
    known_hosts = {
        e.organizer_id for e in (a.event for a in attendance_for_badges(user)) if e.organizer_id
    }
    keys = ["local"]
    if event.organizer_id and event.organizer_id not in known_hosts:
        keys.append("best_guest")
    if event.is_hosts_first_counted:
        keys.append("day_one")
    keys += [key for key, _, rule in config.GROWTH_BADGES if ":" in rule and _matches(rule, event)]
    grows = []
    for key in keys:
        state = states.get(key)
        stage, count = (state.stage, state.count) if state else (0, 0)
        grows.append(
            {"badge": key, "stage": stage, "count": count, "next_threshold": config.next_threshold(key, stage)}
        )
    return grows


def geofence_events(user, now=None):
    """The next 20 upcoming events with a pin that auto check-in should watch."""
    now = now or timezone.now()
    upcoming = _going_events(user).filter(latitude__isnull=False, starts_at__gte=now - timedelta(days=1))
    upcoming = [e for e in upcoming.order_by("starts_at") if not has_ended(e, now)]
    return upcoming[: config.MAX_GEOFENCES]


def show_checkin_reoffer(user, profile, now=None):
    """
    The one-time re-offer of auto check-in: only when it's off, the member
    saw the first offer but not the re-offer, hasn't collected since, and 3
    collect cards expired uncollected since the first offer (declined ones
    are gone, so they don't count).
    """
    now = now or timezone.now()
    offered = profile.checkin_offer_shown_at
    if profile.auto_checkin or profile.checkin_reoffer_shown_at or offered is None:
        return False
    if Attendance.objects.filter(user=user, method=Attendance.Method.COLLECT, created_at__gte=offered).exists():
        return False
    window = timedelta(days=config.COLLECT_WINDOW_DAYS)
    candidates = _going_events(user).filter(starts_at__lte=now - window, starts_at__gte=offered - window - timedelta(days=2))
    expired = [e for e in candidates if offered < event_end(e) + window < now]
    return len(expired) >= config.REOFFER_AFTER_EXPIRED


# ---- Impact numbers (private to the host) --------------------------------------------


def impact(user):
    """
    The host's My Impact numbers (BADGES.md, "Impact metric definitions").
    Empty until their first event counts as hosted. Distinct people only;
    deleted members have no rows, so they drop out by themselves.
    """
    hosted = counted_hosted_events(user)
    if not hosted.exists():
        return {}
    came = Attendance.objects.filter(event__in=hosted).exclude(user=user)
    later_elsewhere = _live(
        Attendance.objects.filter(
            user=OuterRef("user"),
            neighborhood=OuterRef("neighborhood"),
            event__starts_at__gt=OuterRef("event__starts_at"),
        ),
        "event__",
    )
    popular = hosted.annotate(n=Count("attendances")).order_by("-n", "-starts_at").first()
    return {
        "brought_together": came.values("user").distinct().count(),
        "first_timers": came.filter(is_first_in_neighborhood=True).values("user").distinct().count(),
        "came_back": came.annotate(back=Exists(later_elsewhere)).filter(back=True).values("user").distinct().count(),
        "most_popular": {
            "title": popular.title,
            "starts_at": timezone.localtime(popular.starts_at).isoformat(),
            "attendee_count": popular.n,
        },
    }
