"""
Sending one text message (docs/MILESTONE_5.md, "Texting").

Everything goes through `get_texter()`. Until the owner has registered with
the carriers and had the wording reviewed, SMS_LIVE stays off: then the fake
texter is used everywhere, and it only logs what *would* have been sent,
never the phone number. Tests never reach the real provider.

PRIVACY: phone numbers are never logged.
"""

import base64
import hashlib
import hmac
import logging
from dataclasses import dataclass

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)


@dataclass
class Sent:
    message_id: str


class TextUnavailable(Exception):
    """The provider couldn't take it; the job tries again later."""


class FakeTexter:
    """Logs the message instead of sending it. Tests read `outbox`."""

    outbox = []  # (phone, body) pairs, for tests only

    def send(self, phone, body):
        FakeTexter.outbox.append((phone, body))
        logger.info("Text not sent (SMS_LIVE is off): %s", body)
        return Sent(message_id=f"fake-{len(FakeTexter.outbox)}")


class TwilioTexter:
    """Twilio's Messaging Service: one POST per text."""

    def send(self, phone, body):
        url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
        data = {"MessagingServiceSid": settings.SMS_MESSAGING_SERVICE_ID, "To": phone, "Body": body}
        try:
            response = httpx.post(
                url, data=data, auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN), timeout=15
            )
            response.raise_for_status()
            return Sent(message_id=response.json()["sid"])
        except (httpx.HTTPError, KeyError, ValueError) as error:
            logger.warning("Text failed: %s", type(error).__name__)  # never the number or the text
            raise TextUnavailable from error


def get_texter():
    if not settings.SMS_LIVE:
        return FakeTexter()
    if settings.SMS_PROVIDER == "twilio":
        return TwilioTexter()
    raise ValueError(f"Unknown SMS_PROVIDER: {settings.SMS_PROVIDER}")


def signature_is_valid(url, params, signature):
    """
    Twilio signs each webhook call: base64(HMAC-SHA1(auth token, url + every
    form field name and value, sorted by name)). Anything else is refused.
    """
    if not settings.TWILIO_AUTH_TOKEN or not signature:
        return False
    payload = url + "".join(f"{key}{params[key]}" for key in sorted(params))
    digest = hmac.new(settings.TWILIO_AUTH_TOKEN.encode(), payload.encode(), hashlib.sha1).digest()
    return hmac.compare_digest(base64.b64encode(digest).decode(), signature)
