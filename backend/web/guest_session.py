"""
Remembering a guest in their browser: a signed cookie holding only their
guest number, good for 90 days. No password, no profile (MILESTONE_5.md).
"""

from django.conf import settings
from django.core import signing

COOKIE = "guest"
SALT = "guest-sign-in"
MAX_AGE = 90 * 24 * 3600


def current_guest(request):
    from guests.models import Guest

    guest_id = request.get_signed_cookie(COOKIE, default=None, salt=SALT, max_age=MAX_AGE)
    if guest_id is None:
        return None
    return Guest.objects.filter(pk=guest_id, blocked_at__isnull=True).first()


def sign_in(response, guest):
    response.set_signed_cookie(
        COOKIE, guest.pk, salt=SALT, max_age=MAX_AGE, httponly=True, secure=not settings.DEBUG, samesite="Lax"
    )
