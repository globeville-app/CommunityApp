"""
Rate limits that can't be dodged by faking a header.

DRF's default works out "who is this?" for signed-out requests from the
X-Forwarded-For header, which the caller can make up: a different made-up
value on every try meant the login limit never kicked in (review S1). Here
we only trust:
  - the header named in CLIENT_IP_HEADER, which our host's proxy sets itself
    (DigitalOcean App Platform: "DO-Connecting-IP"); or
  - the address of whatever connected to us (REMOTE_ADDR), when no header is
    configured, as in development.
Signed-in requests are still counted per member, as before.
"""

from django.conf import settings
from rest_framework.throttling import ScopedRateThrottle


def client_ip(request):
    """The caller's address, as far as the server can trust it."""
    header = settings.CLIENT_IP_HEADER
    if header:
        meta_key = "HTTP_" + header.upper().replace("-", "_")
        value = request.META.get(meta_key, "").split(",")[0].strip()
        if value:
            return value
    return request.META.get("REMOTE_ADDR", "")


class ClientIPScopedRateThrottle(ScopedRateThrottle):
    def get_ident(self, request):
        return client_ip(request)
