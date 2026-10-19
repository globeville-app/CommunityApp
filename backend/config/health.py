"""
A health check for DigitalOcean: GET /healthz answers "ok".

It sits first in MIDDLEWARE so it answers before the production checks run.
DigitalOcean's check may call the server by its internal address over plain
HTTP, which the host-name check (ALLOWED_HOSTS) and the HTTPS redirect would
otherwise refuse, failing the deploy. The reply reveals nothing.
"""

from django.http import HttpResponse

PATH = "/healthz"


class HealthCheckMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path == PATH and request.method in ("GET", "HEAD"):
            return HttpResponse("ok", content_type="text/plain")
        return self.get_response(request)
