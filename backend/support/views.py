"""
POST /api/support/report: the app's "Report a problem" form.

Works with or without a login, so people stuck in the join flow can report
too. Limited to 5 reports a day per member (or per IP address when not
signed in).
"""

import logging

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from config.errors import ApiError
from profiles.photos import PhotoError, clean_photo

from .models import ProblemReport
from .notify import email_team

logger = logging.getLogger(__name__)

MAX_MESSAGE_LENGTH = 1000


def short(value, length):
    """Technical details are free text from the app; keep them to size."""
    return str(value or "").strip()[:length]


class ProblemReportView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]
    throttle_scope = "problem_report"

    def throttled(self, request, wait):
        # The app shows this code as "You've sent a lot of reports today".
        raise ApiError("daily_limit", status_code=status.HTTP_429_TOO_MANY_REQUESTS)

    def post(self, request):
        message = str(request.data.get("message", "")).strip()
        if not message:
            raise ApiError("message_required")
        if len(message) > MAX_MESSAGE_LENGTH:
            raise ApiError("message_too_long")

        user = request.user if request.user.is_authenticated else None
        contact_email = ""
        if user is None:
            # Members don't need this: the team already has their account email.
            contact_email = str(request.data.get("contact_email", "")).strip()
            if contact_email:
                try:
                    validate_email(contact_email)
                except ValidationError:
                    raise ApiError("invalid_email") from None

        screenshot = None
        upload = request.FILES.get("screenshot")
        if upload is not None:
            try:
                screenshot = clean_photo(upload)  # also strips EXIF, like profile photos
            except PhotoError:
                raise ApiError("bad_image") from None

        language = short(request.data.get("language"), 2)
        report = ProblemReport(
            user=user,
            contact_email=contact_email,
            message=message,
            app_version=short(request.data.get("app_version"), 40),
            os=short(request.data.get("os"), 60),
            device_model=short(request.data.get("device_model"), 100),
            language=language if language in settings.LANGUAGES_AVAILABLE else "",
            screen=short(request.data.get("screen"), 60),
        )
        if screenshot is not None:
            report.screenshot.save(screenshot.name, screenshot, save=False)
        report.save()

        try:
            email_team(report, request)
        except Exception as error:  # the report is saved; email is a bonus
            logger.error("Problem report email failed with %s", type(error).__name__)

        # Only a reference number goes back. Never the screenshot.
        return Response({"id": report.pk}, status=status.HTTP_201_CREATED)
