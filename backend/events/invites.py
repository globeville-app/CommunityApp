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
