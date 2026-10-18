"""
Attendance, badges and My Impact (docs/MILESTONE_3.md, API).

PRIVACY: check-in requests carry no location at all, and nothing here logs
check-ins or collects with user ids.
"""

from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from config.errors import ApiError
from events.timing import event_end
from events.views import get_event, member_profile
from profiles.models import Profile

from . import config, engine
from .models import Attendance, BadgeState, Celebration, Keepsake, ShareLog

CONFLICT = status.HTTP_409_CONFLICT


def celebration_json(c):
    return {"id": c.pk, "badge_key": c.badge_key, "kind": c.kind, "stage": c.stage, "count": c.count}


def badges_json(user, earned_only=False):
    """Every badge (or only earned ones) with stage, count and next threshold."""
    states = {s.badge_key: s for s in BadgeState.objects.filter(user=user)}
    keepsakes = {k.badge_key: k for k in Keepsake.objects.filter(user=user)}
    result = []
    for key in config.GROWTH_KEYS:
        state = states.get(key)
        stage, count = (state.stage, state.count) if state else (0, 0)
        if earned_only and stage == 0:
            continue
        result.append(
            {
                "key": key,
                "kind": "growth",
                "stage": stage,
                "count": count,
                "next_threshold": config.next_threshold(key, stage),
                "earned_at": state.earned_at.isoformat() if state and state.earned_at else None,
            }
        )
    for key in config.KEEPSAKES:
        keepsake = keepsakes.get(key)
        if earned_only and not keepsake:
            continue
        result.append(
            {
                "key": key,
                "kind": "keepsake",
                "stage": 1 if keepsake else 0,
                "count": 0,
                "next_threshold": None,
                "earned_at": keepsake.earned_at.isoformat() if keepsake else None,
            }
        )
    return result


class CatalogView(APIView):
    def get(self, request):
        """Every badge's rules. The words (names, descriptions) live in the app."""
        growth = [
            {"key": key, "kind": "growth", "track": track, "emblem": key, "thresholds": config.TRACK_THRESHOLDS[track]}
            for key, track, _ in config.GROWTH_BADGES
        ]
        keepsakes = [
            {"key": key, "kind": "keepsake", "track": None, "emblem": key, "thresholds": []}
            for key in config.KEEPSAKES
        ]
        return Response(
            {
                "badges": growth + keepsakes,
                "stages": config.STAGES,
                "grove_milestone_multipliers": config.GROVE_MILESTONE_MULTIPLIERS,
                "collect_window_days": config.COLLECT_WINDOW_DAYS,
            }
        )


class MyBadgesView(APIView):
    def get(self, request):
        return Response({"badges": badges_json(request.user)})


class MemberView(APIView):
    """A neighbor's small member page: name, neighborhood, member since, badges."""

    def get(self, request, member_id, badges_only=False):
        me = member_profile(request)
        member = Profile.objects.filter(pk=member_id, neighborhood_id=me.neighborhood_id).select_related(
            "neighborhood"
        ).first()
        if member is None:
            # Other neighborhoods: as if the member didn't exist.
            raise ApiError("member_not_found", status_code=status.HTTP_404_NOT_FOUND)
        visible = member.user_id == request.user.id or member.badge_visibility == Profile.BadgeVisibility.NEIGHBORHOOD
        badges = badges_json(member.user, earned_only=True) if visible else []
        if badges_only:
            return Response({"badges": badges})
        return Response(
            {
                "id": member.pk,
                "display_name": member.display_name,
                "photo_url": request.build_absolute_uri(member.photo.url) if member.photo else None,
                "neighborhood": {"id": member.neighborhood_id, "name": member.neighborhood.name},
                "alias": member.alias or None,
                "member_since": timezone.localtime(member.joined_at).date().isoformat(),
                "badges": badges,
            }
        )


class MemberBadgesView(MemberView):
    def get(self, request, member_id):
        return super().get(request, member_id, badges_only=True)


class CollectCardsView(APIView):
    def get(self, request):
        """Ready-to-collect cards, plus whether to show the auto check-in re-offer."""
        profile = member_profile(request)
        states = {s.badge_key: s for s in BadgeState.objects.filter(user=request.user)}
        cards = []
        for event in engine.collect_events(request.user):
            cards.append(
                {
                    "event_id": event.pk,
                    "title": event.title,
                    "title_alt": event.title_alt or None,
                    "language": event.language,
                    "category": event.category,
                    "starts_at": timezone.localtime(event.starts_at).isoformat(),
                    "collect_until": timezone.localtime(
                        event_end(event) + timezone.timedelta(days=config.COLLECT_WINDOW_DAYS)
                    ).isoformat(),
                    "grows": engine.badges_an_event_grows(request.user, event, states),
                }
            )
        return Response(
            {"cards": cards, "show_checkin_reoffer": engine.show_checkin_reoffer(request.user, profile)}
        )


class CollectView(APIView):
    def post(self, request, event_id):
        event = get_event(request, member_profile(request), event_id)
        celebrations = engine.record_attendance(request.user, event, Attendance.Method.COLLECT)
        return Response({"celebrations": [celebration_json(c) for c in celebrations]}, status=status.HTTP_201_CREATED)


class DeclineView(APIView):
    def post(self, request, event_id):
        event = get_event(request, member_profile(request), event_id)
        engine.decline(request.user, event)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CheckinView(APIView):
    def post(self, request, event_id):
        """
        Called by the phone's geofence task: "I arrived at event X". The
        body must be empty: no coordinates or any other location is accepted.
        """
        if request.data:
            raise ApiError("body_not_accepted")
        event = get_event(request, member_profile(request), event_id)
        celebrations = engine.record_attendance(request.user, event, Attendance.Method.AUTO)
        return Response({"celebrations": [celebration_json(c) for c in celebrations]}, status=status.HTTP_201_CREATED)


class GeofencesView(APIView):
    def get(self, request):
        """Up to 20 upcoming events to watch, with the pin and the check-in window."""
        member_profile(request)
        fences = []
        for event in engine.geofence_events(request.user):
            opens = event.starts_at - timezone.timedelta(minutes=config.CHECKIN_EARLY_MINUTES)
            fences.append(
                {
                    "event_id": event.pk,
                    "latitude": float(event.latitude),
                    "longitude": float(event.longitude),
                    "radius_meters": config.GEOFENCE_RADIUS_METERS,
                    "opens_at": timezone.localtime(opens).isoformat(),
                    "closes_at": timezone.localtime(event_end(event)).isoformat(),
                }
            )
        return Response({"geofences": fences})


class ImpactView(APIView):
    def get(self, request):
        member_profile(request)
        return Response(engine.impact(request.user))


class CelebrationsView(APIView):
    def get(self, request):
        unseen = Celebration.objects.filter(user=request.user, seen_at__isnull=True)
        return Response({"celebrations": [celebration_json(c) for c in unseen]})


class CelebrationsSeenView(APIView):
    def post(self, request):
        """Mark unlock moments as shown: the listed ids, or all of them."""
        unseen = Celebration.objects.filter(user=request.user, seen_at__isnull=True)
        ids = request.data.get("ids")
        if isinstance(ids, list):
            unseen = unseen.filter(pk__in=ids)
        unseen.update(seen_at=timezone.now())
        return Response(status=status.HTTP_204_NO_CONTENT)


class SharedView(APIView):
    def post(self, request, badge_key):
        """Count a share: the badge and the date only. Never who, or where."""
        if badge_key not in config.ALL_BADGE_KEYS:
            raise ApiError("badge_not_found", status_code=status.HTTP_404_NOT_FOUND)
        ShareLog.objects.create(badge_key=badge_key)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CheckinOfferSeenView(APIView):
    def post(self, request):
        """{"which": "first" | "reoffer"}: stamp it so that offer never shows again."""
        profile = member_profile(request)
        which = request.data.get("which")
        field = {"first": "checkin_offer_shown_at", "reoffer": "checkin_reoffer_shown_at"}.get(which)
        if field is None:
            raise ApiError("invalid_offer")
        if getattr(profile, field) is None:
            setattr(profile, field, timezone.now())
            profile.save(update_fields=[field])
        return Response(status=status.HTTP_204_NO_CONTENT)
