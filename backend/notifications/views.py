"""Push tokens and the one-time notification ask (docs/MILESTONE_4.md, API)."""

from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from config.errors import ApiError
from events.views import member_profile

from .models import PushToken

TOKEN_MAX = 200


def clean_token(request):
    token = str(request.data.get("token") or "").strip()
    # Expo tokens look like "ExponentPushToken[xxxx]".
    if not token or len(token) > TOKEN_MAX or not token.startswith(("ExponentPushToken[", "ExpoPushToken[")):
        raise ApiError("invalid_push_token")
    return token


class PushTokensView(APIView):
    def post(self, request):
        """Register this phone. A phone that switched accounts moves to the new one."""
        token = clean_token(request)
        platform = request.data.get("platform") if request.data.get("platform") in ("ios", "android") else ""
        PushToken.objects.update_or_create(
            token=token, defaults={"user": request.user, "platform": platform, "last_used_at": timezone.now()}
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    def delete(self, request):
        """Forget this phone (on logout, or when notifications are turned off)."""
        token = clean_token(request)
        PushToken.objects.filter(token=token, user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class NotifOfferSeenView(APIView):
    def post(self, request):
        """Stamp the one-time "Get a reminder the day before?" ask."""
        profile = member_profile(request)
        if profile.notif_offer_shown_at is None:
            profile.notif_offer_shown_at = timezone.now()
            profile.save(update_fields=["notif_offer_shown_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)
