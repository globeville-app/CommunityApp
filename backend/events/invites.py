"""
Invite links (docs/MILESTONE_5.md): the host's link and message, resetting
it, and what happens when a member opens someone's link in the app.
"""

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import language_of
from config.errors import ApiError
from config.wording import words

from .models import EventAccess, InviteLink
from .views import can_manage, event_json, events_for, get_event, member_profile


def invite_url(link):
    return f"{settings.PUBLIC_BASE_URL}/e/{link.code}"


def invite_json(event, user):
    """The link and a ready-to-send message in the host's language."""
    from notifications.texts import _day, title_for

    link = InviteLink.current(event)
    language = language_of(user)
    starts = timezone.localtime(event.starts_at)
    message = words("invite", language)["message"].format(
        title=title_for(event, language), date=_day(starts, language), link=invite_url(link)
    )
    return {"code": link.code, "url": invite_url(link), "message": message}


def managed_event(request, event_id):
    event = get_event(request, member_profile(request), event_id)
    if not can_manage(event, request.user):
        raise ApiError("not_organizer", status_code=status.HTTP_403_FORBIDDEN)
    return event


class EventInviteView(APIView):
    def get(self, request, event_id):
        """The host's invite link and message. Hosts and organization admins only."""
        return Response(invite_json(managed_event(request, event_id), request.user))


class EventInviteResetView(APIView):
    def post(self, request, event_id):
        """Old links stop working (they show "expired"); people who already opened one keep access."""
        event = managed_event(request, event_id)
        InviteLink.objects.filter(event=event, revoked_at__isnull=True).update(revoked_at=timezone.now())
        return Response(invite_json(event, request.user))


class OpenInviteView(APIView):
    def get(self, request, code):
        """A member opened an invite link: they can see and use the event from now on, any neighborhood."""
        profile = member_profile(request)
        link = InviteLink.objects.filter(code=code).select_related("event").first()
        if link is None:
            raise ApiError("invite_not_found", status_code=status.HTTP_404_NOT_FOUND)
        if link.revoked_at is not None:
            raise ApiError("invite_revoked", status_code=status.HTTP_410_GONE)
        EventAccess.objects.get_or_create(user=request.user, event=link.event, defaults={"via_invite": link})
        event = events_for(profile, request.user).get(pk=link.event_id)
        return Response(event_json(event, request, profile, timezone.now()))


class InviteSharedView(APIView):
    def post(self, request, event_id):
        """The host opened the share sheet: one more to the daily count (owner stats). Nothing about who."""
        from web.models import DailyCount

        managed_event(request, event_id)
        DailyCount.bump("invite_share")
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---- The host's guest list ---------------------------------------------------------


def came_count(event):
    """
    "Came: X of Y (confirmed)" after the event. X is confirmed attendance:
    members who checked in or collected, guests who joined and claimed, and
    anonymous confirmations at sensitive events. Y is everyone who was going.
    Never who didn't come.
    """
    from badges.models import Attendance
    from events.models import Going
    from guests.rsvp import going_guests

    confirmed = Attendance.objects.filter(event=event).count() + event.anonymous_attendee_count
    # Guests who claimed are members now (with their own "going"), so they're not counted twice.
    unclaimed_guests = going_guests(event).exclude(pending__claimed_at__isnull=False).count()
    going = Going.objects.filter(event=event).count() + event.anonymous_attendee_count + unclaimed_guests
    return {"confirmed": confirmed, "of": going}


class GuestListView(APIView):
    def get(self, request, event_id):
        """
        Who's going, for the host and organization admins only (Changes
        Milestone 2): display names for members, first names for guests.
        Never phone numbers. For resource fairs and donation drives only the
        counts are shown, since going there can mean someone needed help.
        """
        from badges import config as badge_config
        from events.models import Going
        from events.timing import has_ended
        from events.views import going_total
        from guests.rsvp import going_guests

        event = managed_event(request, event_id)
        names_hidden = event.category in badge_config.SENSITIVE_CATEGORIES
        members, guests = [], []
        if not names_hidden:
            goings = Going.objects.filter(event=event).select_related("user__profile").order_by("created_at")
            members = [
                {"display_name": g.user.profile.display_name} for g in goings if hasattr(g.user, "profile")
            ]
            unclaimed = going_guests(event).exclude(pending__claimed_at__isnull=False).select_related("guest")
            guests = [{"id": r.pk, "first_name": r.guest.first_name} for r in unclaimed.order_by("created_at")]
        ended = has_ended(event, timezone.now())
        return Response(
            {
                "going_count": going_total(event),
                "names_hidden": names_hidden,
                "members": members,
                "guests": guests,
                "came": came_count(event) if ended else None,
            }
        )


class RemoveGuestView(APIView):
    def post(self, request, event_id, rsvp_id):
        """The host removes a guest: they stop counting, and their texts and badge claim go."""
        from guests.models import ACTIVE_RSVP, GuestRSVP
        from guests.rsvp import remove_by_host

        event = managed_event(request, event_id)
        rsvp = GuestRSVP.objects.filter(ACTIVE_RSVP, pk=rsvp_id, event=event).first()
        if rsvp is None:
            raise ApiError("guest_not_found", status_code=status.HTTP_404_NOT_FOUND)
        remove_by_host(rsvp)
        return Response(status=status.HTTP_204_NO_CONTENT)
