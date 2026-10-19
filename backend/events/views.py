"""
The neighborhood calendar API (docs/MILESTONE_2.md).

Every event belongs to one neighborhood and only its members can see it.
For anyone else it simply doesn't exist (404), so the API never reveals it.
"""

from datetime import timedelta

from django.db import transaction
from django.db.models import Count, Exists, OuterRef, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import language_of
from config.errors import ApiError
from profiles.models import Profile

from notifications import scheduling

from .categories import GROUP_KEYS, GROUPS, group_of, suggest_category
from .models import Event, EventReport, Going, TranslationCache
from .partiful import fetch_og_title
from .timing import has_ended
from .translation import TranslationUnavailable, get_translator
from .validation import clean_event, is_partiful_url

DAILY_EVENT_LIMIT = 10
REPORT_REASON_MAX = 200


# ---- Helpers -------------------------------------------------------------------


def member_profile(request):
    """The caller's profile; events need a neighborhood, so joining comes first."""
    profile = Profile.objects.filter(user=request.user).first()
    if profile is None:
        raise ApiError("profile_not_found", status_code=status.HTTP_404_NOT_FOUND)
    return profile


def admin_org_ids(user):
    """The organizations this member runs (any status)."""
    from organizations.models import OrganizationAdmin

    return list(OrganizationAdmin.objects.filter(user=user).values_list("organization_id", flat=True))


def events_for(profile, user, own_neighborhood_only=False):
    """
    Events the member can see, with the counts the app shows: their own
    neighborhood's, plus (for organization admins) their organizations'
    events in any neighborhood, so they can manage them.
    """
    from organizations.models import Follow

    visible = Q(neighborhood_id=profile.neighborhood_id)
    if not own_neighborhood_only:
        visible |= Q(organization_id__in=admin_org_ids(user))
    return (
        Event.objects.filter(visible)
        .select_related("organizer__profile", "organization")
        .annotate(
            going_count=Count("goings", distinct=True),
            is_going=Exists(Going.objects.filter(event=OuterRef("pk"), user=user)),
            is_following=Exists(Follow.objects.filter(organization=OuterRef("organization"), user=user)),
        )
    )


def can_manage(event, user):
    """Edit and cancel: the member who posted it, or any admin of its organization."""
    if event.organization_id:
        return event.organization.is_admin(user)
    return event.organizer_id == user.id


def get_event(request, profile, event_id):
    try:
        return events_for(profile, request.user).get(pk=event_id)
    except Event.DoesNotExist:
        # Also for events in other neighborhoods: don't reveal they exist.
        raise ApiError("event_not_found", status_code=status.HTTP_404_NOT_FOUND) from None


def organizer_profile(event):
    return getattr(event.organizer, "profile", None) if event.organizer_id else None


def organizer_name(event):
    """
    Display name only ("Ana R."). None once the organizer deleted their
    account, and for organization events: who posted those is for the team only.
    """
    if event.organization_id:
        return None
    profile = organizer_profile(event)
    return profile.display_name if profile else None


def event_json(event, request, profile, now):
    """The event as the app sees it. Never includes sponsor_name or who's going."""
    return {
        "id": event.pk,
        "group": group_of(event.category),
        "category": event.category,
        "category_other": event.category_other or None,
        "title": event.title,
        "description": event.description,
        "language": event.language,
        "title_alt": event.title_alt or None,
        "description_alt": event.description_alt or None,
        # Returned in Denver time, e.g. "2026-10-24T18:00:00-06:00".
        "starts_at": timezone.localtime(event.starts_at).isoformat(),
        "ends_at": timezone.localtime(event.ends_at).isoformat() if event.ends_at else None,
        "location_text": event.location_text,
        # The meeting place's pin (null for events posted before pins existed).
        "latitude": float(event.latitude) if event.latitude is not None else None,
        "longitude": float(event.longitude) if event.longitude is not None else None,
        # Organizers of upcoming pinless events are asked to add one.
        "needs_pin": event.latitude is None and can_manage(event, request.user) and not has_ended(event, now),
        "partiful_url": event.partiful_url or None,
        "status": event.status,
        "is_past": has_ended(event, now),
        "organizer_name": organizer_name(event),
        # Opens the organizer's member page (null for a former neighbor or an organization event).
        "organizer_member_id": organizer_profile(event).pk if organizer_name(event) else None,
        # "Hosted by [Organization]"; the page may be hidden (no admin left).
        "organization": (
            {
                "id": event.organization_id,
                "name": event.organization.name,
                "type": event.organization.type,
                "has_page": event.organization.status == "approved",
            }
            if event.organization_id
            else None
        ),
        "is_following": bool(getattr(event, "is_following", False)) if event.organization_id else False,
        # Can edit and cancel it.
        "is_organizer": can_manage(event, request.user),
        "going_count": event.going_count,
        "is_going": event.is_going,
        "matches_interests": event.category in (profile.interests or []),
    }


# ---- List and create -------------------------------------------------------------


def posting_as(request, profile):
    """
    (organization, neighborhood id) for a new event. Members post in their
    own neighborhood, never one sent by the app. Organization admins may
    pick any neighborhood the organization serves.
    """
    from organizations.models import Organization

    org_id = request.data.get("organization")
    if org_id in (None, ""):
        return None, profile.neighborhood_id
    organization = Organization.objects.filter(pk=org_id).first() if str(org_id).isdigit() else None
    if organization is None or not organization.is_admin(request.user):
        raise ApiError("not_org_admin", status_code=status.HTTP_403_FORBIDDEN)
    if organization.status != Organization.Status.APPROVED:
        raise ApiError("org_not_approved", status_code=status.HTTP_409_CONFLICT)
    neighborhood_id = request.data.get("neighborhood")
    served = organization.neighborhoods.filter(pk=neighborhood_id).exists() if str(neighborhood_id).isdigit() else False
    if not served:
        raise ApiError("neighborhood_not_served")
    return organization, int(neighborhood_id)



class EventListView(APIView):
    def get(self, request):
        """Upcoming events (active and cancelled), soonest first."""
        profile = member_profile(request)
        now = timezone.now()
        # Not ended yet. An event with no end time lasts until midnight, so
        # look back a day, then apply the exact rule (events/timing.py).
        events = events_for(profile, request.user, own_neighborhood_only=True).filter(
            Q(starts_at__gte=now - timedelta(days=1)) | Q(ends_at__gte=now)
        )

        group = request.query_params.get("group")
        if group:
            if group not in GROUP_KEYS:
                raise ApiError("invalid_group")
            events = events.filter(category__in=dict(GROUPS)[group])
        if request.query_params.get("for_you") == "true":
            events = events.filter(category__in=profile.interests or [])
        if request.query_params.get("following") == "true":
            events = events.filter(is_following=True)

        events = [e for e in events.order_by("starts_at", "pk") if not has_ended(e, now)]
        return Response({"events": [event_json(e, request, profile, now) for e in events]})

    def post(self, request):
        profile = member_profile(request)
        now = timezone.now()
        recent = Event.objects.filter(organizer=request.user, created_at__gte=now - timedelta(days=1)).count()
        if recent >= DAILY_EVENT_LIMIT:
            raise ApiError("daily_limit", status_code=status.HTTP_429_TOO_MANY_REQUESTS)

        fields = clean_event(request.data, default_language=language_of(request.user), now=now)
        organization, neighborhood_id = posting_as(request, profile)
        with transaction.atomic():
            event = Event.objects.create(
                neighborhood_id=neighborhood_id, organizer=request.user, organization=organization, **fields
            )
            if organization is None and profile.role != Profile.Role.ORGANIZER:
                profile.role = Profile.Role.ORGANIZER
                profile.save(update_fields=["role"])
        event = get_event(request, profile, event.pk)
        return Response(event_json(event, request, profile, now), status=status.HTTP_201_CREATED)


# ---- One event -----------------------------------------------------------------


class EventDetailView(APIView):
    def get(self, request, event_id):
        profile = member_profile(request)
        event = get_event(request, profile, event_id)
        return Response(event_json(event, request, profile, timezone.now()))

    def patch(self, request, event_id):
        """Edit (organizer only). The category can change too."""
        profile = member_profile(request)
        event = get_event(request, profile, event_id)
        if not can_manage(event, request.user):
            raise ApiError("not_organizer", status_code=status.HTTP_403_FORBIDDEN)
        if event.status == Event.Status.CANCELLED:
            raise ApiError("event_cancelled", status_code=status.HTTP_409_CONFLICT)

        now = timezone.now()
        fields = clean_event(request.data, event=event, default_language=event.language, now=now)
        with transaction.atomic():
            Event.objects.filter(pk=event.pk).update(updated_at=now, **fields)
            # The text may have changed, so old machine translations are stale.
            TranslationCache.objects.filter(event=event).delete()
        moved = fields.get("starts_at", event.starts_at) != event.starts_at
        event = get_event(request, profile, event.pk)
        if moved:
            # Reminders move with the event.
            scheduling.event_time_changed(event, now)
        return Response(event_json(event, request, profile, now))


class EventCancelView(APIView):
    def post(self, request, event_id):
        """Cancel (organizer only). The event and its "going" records stay."""
        profile = member_profile(request)
        event = get_event(request, profile, event_id)
        if not can_manage(event, request.user):
            raise ApiError("not_organizer", status_code=status.HTTP_403_FORBIDDEN)
        Event.objects.filter(pk=event.pk).update(status=Event.Status.CANCELLED, updated_at=timezone.now())
        event = get_event(request, profile, event.pk)
        # One notice right away to everyone going (if they allow it).
        scheduling.event_cancelled(event)
        return Response(event_json(event, request, profile, timezone.now()))


class GoingView(APIView):
    """PUT = I'm going, DELETE = not anymore. Only the count is ever shown."""

    def _check(self, request, event_id):
        profile = member_profile(request)
        event = get_event(request, profile, event_id)
        if event.status == Event.Status.CANCELLED:
            raise ApiError("event_cancelled", status_code=status.HTTP_409_CONFLICT)
        if has_ended(event, timezone.now()):
            raise ApiError("event_past", status_code=status.HTTP_409_CONFLICT)
        return event

    def _reply(self, event, request):
        return Response(
            {
                "going_count": Going.objects.filter(event=event).count(),
                "is_going": Going.objects.filter(event=event, user=request.user).exists(),
            }
        )

    def put(self, request, event_id):
        event = self._check(request, event_id)
        Going.objects.get_or_create(event=event, user=request.user)
        scheduling.schedule_reminder(request.user, event)
        return self._reply(event, request)

    def delete(self, request, event_id):
        event = self._check(request, event_id)
        Going.objects.filter(event=event, user=request.user).delete()
        scheduling.unschedule_reminder(request.user, event)
        return self._reply(event, request)


class EventReportView(APIView):
    def post(self, request, event_id):
        profile = member_profile(request)
        event = get_event(request, profile, event_id)
        reason = str(request.data.get("reason") or "").strip()
        if not reason:
            raise ApiError("reason_required")
        if len(reason) > REPORT_REASON_MAX:
            raise ApiError("reason_too_long")
        EventReport.objects.create(event=event, reporter=request.user, reason=reason)
        return Response({"ok": True}, status=status.HTTP_201_CREATED)


class EventTranslateView(APIView):
    def post(self, request, event_id):
        """
        {target: "es"} → the title and description in that language: the
        organizer's own version if there is one, otherwise a machine
        translation, cached until the event is edited.
        """
        profile = member_profile(request)
        event = get_event(request, profile, event_id)
        target = request.data.get("target")
        if target not in ("en", "es"):
            raise ApiError("invalid_language")

        if target == event.language:
            return Response(
                {"title": event.title, "description": event.description, "target": target, "machine": False}
            )
        if event.title_alt:
            return Response(
                {"title": event.title_alt, "description": event.description_alt, "target": target, "machine": False}
            )

        translator = get_translator()
        if translator is None:
            raise ApiError("translation_unavailable", status_code=status.HTTP_503_SERVICE_UNAVAILABLE)
        try:
            result = {
                field: self._translate(translator, event, field, target)
                for field in ("title", "description")
            }
        except TranslationUnavailable:
            raise ApiError("translation_failed", status_code=status.HTTP_502_BAD_GATEWAY) from None
        return Response({**result, "target": target, "machine": True})

    def _translate(self, translator, event, field, target):
        text = getattr(event, field)
        if not text:
            return ""
        cached = TranslationCache.objects.filter(event=event, field=field, target_language=target).first()
        if cached:
            return cached.text
        # Only the event's own text is sent to the provider.
        translated = translator.translate(text, event.language, target)
        TranslationCache.objects.create(event=event, field=field, target_language=target, text=translated)
        return translated


class PartifulPreviewView(APIView):
    def post(self, request):
        """{url} → {title, suggested_category}; both empty if anything fails."""
        url = str(request.data.get("url") or "").strip()
        title = fetch_og_title(url) if is_partiful_url(url) else None
        title = title[:80] if title else None
        return Response({"title": title, "suggested_category": suggest_category(title) if title else None})
