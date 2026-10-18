"""
Token login that also notes when a member was last seen, for the owner
stats page's "active members". At most one database write per member per
hour, and only a timestamp.
"""

from datetime import timedelta

from django.utils import timezone
from rest_framework.authentication import TokenAuthentication

from .models import Account

SEEN_EVERY = timedelta(hours=1)


class SeenTokenAuthentication(TokenAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result is not None:
            user, _token = result
            now = timezone.now()
            # One UPDATE that only matches when the stamp is missing or old,
            # so most requests write nothing.
            stale = Account.objects.filter(user=user).filter(
                last_seen_at__isnull=True
            ) | Account.objects.filter(user=user, last_seen_at__lt=now - SEEN_EVERY)
            stale.update(last_seen_at=now)
        return result
