"""
Sending through Expo's push service. Tests replace post_to_expo, so they
never call Expo.

PRIVACY: tokens and message text are never logged.
"""

import logging

import httpx
from django.conf import settings

from . import config
from .models import PushReceipt, PushToken

logger = logging.getLogger(__name__)


class PushUnavailable(Exception):
    """Expo couldn't be reached; the caller tries again later."""


def _post(url, payload):
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    if settings.EXPO_ACCESS_TOKEN:
        headers["Authorization"] = f"Bearer {settings.EXPO_ACCESS_TOKEN}"
    try:
        response = httpx.post(url, json=payload, headers=headers, timeout=config.EXPO_TIMEOUT_SECONDS)
        response.raise_for_status()
        return response.json()["data"]
    except (httpx.HTTPError, KeyError, ValueError) as error:
        # Only the kind of error: never tokens or text.
        logger.warning("Expo push failed: %s", type(error).__name__)
        raise PushUnavailable from error


def post_to_expo(messages):
    """POST the messages; returns Expo's list of tickets, one per message."""
    return _post(config.EXPO_PUSH_URL, messages)


def get_receipts_from_expo(ticket_ids):
    """Expo's receipts for these tickets: {ticket id: {"status": ..., "details": ...}}."""
    return _post(config.EXPO_RECEIPTS_URL, {"ids": ticket_ids})


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
        try:
            tickets = post_to_expo(messages[start : start + config.EXPO_BATCH_SIZE])
        except PushUnavailable:
            # Some phones already got it: count it as sent rather than retry
            # and push those phones twice. Only a total failure is retried.
            if accepted:
                return True
            raise
        for token, ticket in zip(batch, tickets):
            if ticket.get("status") == "ok":
                accepted = True
                if ticket.get("id"):
                    PushReceipt.objects.get_or_create(ticket_id=ticket["id"], defaults={"token": token})
            elif (ticket.get("details") or {}).get("error") == "DeviceNotRegistered":
                token.delete()
    return accepted


def check_receipts(now=None):
    """
    Ask Expo what happened to messages sent at least 15 minutes ago, and
    remove the tokens of phones that no longer have the app. Expo only tells
    some of these in its first answer. Returns how many tokens were removed.
    """
    from datetime import timedelta

    from django.utils import timezone

    now = now or timezone.now()
    PushReceipt.objects.filter(created_at__lt=now - timedelta(hours=config.RECEIPT_KEEP_HOURS)).delete()
    due = list(PushReceipt.objects.filter(created_at__lte=now - timedelta(minutes=config.RECEIPT_WAIT_MINUTES)))
    removed = 0
    for start in range(0, len(due), config.EXPO_RECEIPT_BATCH_SIZE):
        batch = due[start : start + config.EXPO_RECEIPT_BATCH_SIZE]
        try:
            receipts = get_receipts_from_expo([r.ticket_id for r in batch])
        except PushUnavailable:
            return removed  # try again next run
        for receipt in batch:
            answer = receipts.get(receipt.ticket_id)
            if answer is None:
                continue  # not ready yet
            if (answer.get("details") or {}).get("error") == "DeviceNotRegistered":
                deleted, _ = PushToken.objects.filter(pk=receipt.token_id).delete()  # also deletes its receipts
                removed += 1 if deleted else 0
            PushReceipt.objects.filter(pk=receipt.pk).delete()
    return removed
