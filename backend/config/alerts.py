"""
A short email to the team when the server crashes (review O8, PLAN P14).

Django has a built-in error email, but it includes everything about the
request, which could contain an address being matched or a problem report's
text. This one sends only what kind of error happened, on which page, and
where in the code: no request data, no error message, no variable values.
No outside service is involved (docs/STORE_PRIVACY.md: no third-party crash
reporting). At most one email per kind of error and page every 10 minutes.
"""

import logging
import traceback

from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail

QUIET_FOR_SECONDS = 600


class ServerErrorEmailHandler(logging.Handler):
    def emit(self, record):
        if not settings.SERVER_ERROR_EMAILS or not record.exc_info:
            return
        try:
            kind = record.exc_info[0].__name__
            request = getattr(record, "request", None)
            page = f"{request.method} {request.path}" if request is not None else "(no request)"
            frames = traceback.extract_tb(record.exc_info[2])
            where = f"{frames[-1].filename}:{frames[-1].lineno} in {frames[-1].name}" if frames else "unknown"
            if not cache.add(f"error-email:{kind}:{page}", 1, timeout=QUIET_FOR_SECONDS):
                return  # already told the team about this one recently
            send_mail(
                subject=f"{settings.APP_NAME} server error: {kind} on {page}",
                message=f"{kind} on {page}\nIn {where}\n\nThe details are in DigitalOcean: the app's Runtime Logs.",
                from_email=None,
                recipient_list=settings.SERVER_ERROR_EMAILS,
            )
        except Exception:
            self.handleError(record)
