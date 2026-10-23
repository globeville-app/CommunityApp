"""
Replies to our texts (docs/MILESTONE_5.md, "Opt-out replies").

The provider calls POST /webhooks/sms for each incoming text and delivery
update, signed with our account's secret; anything without a valid
signature is refused. STOP and its synonyms opt the number out at once
(no texts at all, not even codes, until START); HELP gets a short answer.

PRIVACY: numbers and message text are never logged.
"""

from xml.sax.saxutils import escape

from django.conf import settings
from django.http import HttpResponse, HttpResponseForbidden
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from config.wording import words
from guests.models import Guest
from guests.phones import NotUSNumber, normalize_us

from .models import ScheduledText
from .texter import signature_is_valid

STOP_WORDS = {"STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "ALTO", "PARAR"}
START_WORDS = {"START", "UNSTOP"}
HELP_WORDS = {"HELP", "AYUDA"}


def _reply(text=None):
    """Twilio's answer format: an optional text back to the sender."""
    message = f"<Message>{escape(text)}</Message>" if text else ""
    return HttpResponse(f'<?xml version="1.0" encoding="UTF-8"?><Response>{message}</Response>', content_type="text/xml")


@csrf_exempt
@require_POST
def incoming(request):
    params = request.POST.dict()
    if not signature_is_valid(request.build_absolute_uri(), params, request.headers.get("X-Twilio-Signature", "")):
        return HttpResponseForbidden()
    if "Body" not in params:
        return _reply()  # a delivery update; nothing to do

    word = params["Body"].strip().upper()
    try:
        guest = Guest.objects.filter(phone=normalize_us(params.get("From"))).first()
    except NotUSNumber:
        guest = None

    if word in STOP_WORDS:
        if guest is not None:
            now = timezone.now()
            Guest.objects.filter(pk=guest.pk).update(opted_out_at=now)
            ScheduledText.objects.filter(guest=guest, sent_at__isnull=True, skipped_reason="").update(
                skipped_reason="opted_out"
            )
        return _reply()  # the carrier sends the standard "you're unsubscribed" message
    if word in START_WORDS:
        if guest is not None:
            Guest.objects.filter(pk=guest.pk).update(opted_out_at=None)
        return _reply()
    if word in HELP_WORDS:
        language = guest.language if guest else ("es" if word == "AYUDA" else "en")
        return _reply(words("texts", language)["help"].format(app=settings.APP_NAME, email=settings.SUPPORT_EMAIL))
    return _reply()
