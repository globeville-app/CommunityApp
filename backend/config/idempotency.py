"""
"Send it twice, get it once" for the app's create requests (review A7).

On a slow connection the phone may send the same form twice: a double tap,
or a retry after a reply that never arrived. The app adds an
Idempotency-Key header (a random id per form); the first reply is kept for
a day, and the same key from the same person gets that reply again instead
of creating a second event or report. Requests without the header work as
before.
"""

from functools import wraps

from django.core.cache import cache
from rest_framework.response import Response

from .throttling import client_ip

HEADER = "HTTP_IDEMPOTENCY_KEY"
KEEP_SECONDS = 24 * 3600


def once_per_key(view_method):
    @wraps(view_method)
    def wrapper(self, request, *args, **kwargs):
        key = request.META.get(HEADER, "").strip()
        if not key or len(key) > 100:
            return view_method(self, request, *args, **kwargs)
        who = f"user:{request.user.pk}" if request.user.is_authenticated else f"ip:{client_ip(request)}"
        cache_key = f"idempotency:{who}:{request.path}:{key}"
        kept = cache.get(cache_key)
        if kept is not None:
            return Response(kept["data"], status=kept["status"])
        response = view_method(self, request, *args, **kwargs)
        if 200 <= response.status_code < 300:
            cache.set(cache_key, {"data": response.data, "status": response.status_code}, KEEP_SECONDS)
        return response

    return wrapper
