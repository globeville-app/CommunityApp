"""
Sending through Expo's push service. Tests replace post_to_expo, so they
never call Expo.

PRIVACY: tokens and message text are never logged.
"""

import logging

import httpx
from django.conf import settings

from . import config
from .models import PushToken

logger = logging.getLogger(__name__)


class PushUnavailable(Exception):
    """Expo couldn't be reached; the caller tries again later."""


def post_to_expo(messages):
    """POST the messages; returns Expo's list of tickets, one per message."""
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    if settings.EXPO_ACCESS_TOKEN:
        headers["Authorization"] = f"Bearer {settings.EXPO_ACCESS_TOKEN}"
    try:
        response = httpx.post(config.EXPO_PUSH_URL, json=messages, headers=headers, timeout=config.EXPO_TIMEOUT_SECONDS)
        response.raise_for_status()
        return response.json()["data"]
    except (httpx.HTTPError, KeyError, ValueError) as error:
        # Only the kind of error: never tokens or text.
        logger.warning("Expo push failed: %s", type(error).__name__)
        raise PushUnavailable from error


def send_to_user(user, body, data=None):
    """
    Push `body` to every phone the member registered. Returns True if Expo
    accepted it for at least one phone. Tokens Expo says are no longer valid
    (the app was deleted, say) are removed.
    """
    tokens = list(PushToken.objects.filter(user=user))
    if not tokens:
        return False
    messages = [{"to": t.token, "body": body, "sound": "default", "data": data or {}} for t in tokens]
    accepted = False
    for start in range(0, len(messages), config.EXPO_BATCH_SIZE):
        batch = tokens[start : start + config.EXPO_BATCH_SIZE]
        tickets = post_to_expo(messages[start : start + config.EXPO_BATCH_SIZE])
        for token, ticket in zip(batch, tickets):
            if ticket.get("status") == "ok":
                accepted = True
            elif (ticket.get("details") or {}).get("error") == "DeviceNotRegistered":
                token.delete()
    return accepted
