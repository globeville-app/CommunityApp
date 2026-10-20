"""
Token login, one token per phone (accounts.models.DeviceToken). It also notes
when a member was last seen, for the owner stats page's "active members", and
when each phone's login was last used, so unused ones expire. At most one
database write per phone per hour, and only timestamps.
"""

from datetime import timedelta

from django.utils import timezone
from rest_framework import exceptions
from rest_framework.authentication import BaseAuthentication, get_authorization_header

from .models import Account, DeviceToken

SEEN_EVERY = timedelta(hours=1)
# A phone's login stops working after this long without being used.
EXPIRES_AFTER = timedelta(days=90)


class DeviceTokenAuthentication(BaseAuthentication):
    keyword = "Token"

    def authenticate(self, request):
        parts = get_authorization_header(request).split()
        if not parts or parts[0].lower() != self.keyword.lower().encode():
            return None
        if len(parts) != 2:
            raise exceptions.AuthenticationFailed()
        try:
            key = parts[1].decode()
        except UnicodeError:
            raise exceptions.AuthenticationFailed() from None

        token = DeviceToken.objects.select_related("user").filter(key_hash=DeviceToken.hash(key)).first()
        if token is None or not token.user.is_active:
            raise exceptions.AuthenticationFailed()
        now = timezone.now()
        if token.last_used_at < now - EXPIRES_AFTER:
            token.delete()
            raise exceptions.AuthenticationFailed()

        if token.last_used_at < now - SEEN_EVERY:
            DeviceToken.objects.filter(pk=token.pk).update(last_used_at=now)
        # One UPDATE that only matches when the stamp is missing or old, so
        # most requests write nothing.
        stale = Account.objects.filter(user=token.user).filter(
            last_seen_at__isnull=True
        ) | Account.objects.filter(user=token.user, last_seen_at__lt=now - SEEN_EVERY)
        stale.update(last_seen_at=now)
        return token.user, token

    def authenticate_header(self, request):
        return self.keyword
