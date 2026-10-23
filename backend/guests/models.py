"""
Guests: people who RSVP to an event from its invite link in a web browser,
with no app and no account (docs/MILESTONE_5.md).

PRIVACY: a guest is a first name and a US mobile number, kept only to text
them about events they RSVP'd to. The number is never shown (not even to
hosts), never logged, and deleted on schedule (accounts/retention.py).
"""

import hashlib
import hmac
import secrets

from django.conf import settings
from django.db import models

from events.models import Event

FIRST_NAME_MAX = 30
# The wording the guest agreed to. Bump it whenever the consent text changes.
CONSENT_VERSION = "2026-10-v1"


class Guest(models.Model):
    first_name = models.CharField(max_length=FIRST_NAME_MAX)
    phone = models.CharField(max_length=16, unique=True)  # E.164, e.g. +13035550123
    phone_verified_at = models.DateTimeField(null=True, blank=True)
    language = models.CharField(max_length=2, default="en")
    # Replied STOP: nothing at all is sent to this number until START.
    opted_out_at = models.DateTimeField(null=True, blank=True)
    # Blocked by the team in Django admin.
    blocked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def phone_last4(self):
        return self.phone[-4:]

    def __str__(self):
        return f"{self.first_name} (…{self.phone_last4})"


class GuestConsent(models.Model):
    """Proof of what a guest agreed to, when, in which wording and language. Never changed, only added."""

    class Kind(models.TextChoices):
        EVENT_TEXTS = "event_texts", "Code and event updates"
        COLLECT_TEXTS = "collect_texts", "Collect your badge"

    guest = models.ForeignKey(Guest, on_delete=models.CASCADE, related_name="consents")
    kind = models.CharField(max_length=20, choices=Kind.choices)
    consent_version = models.CharField(max_length=20)
    language = models.CharField(max_length=2)
    created_at = models.DateTimeField(auto_now_add=True)


class GuestRSVP(models.Model):
    """A guest's "I'm going". Counted in the event's going count until cancelled or removed."""

    guest = models.ForeignKey(Guest, on_delete=models.CASCADE, related_name="rsvps")
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="guest_rsvps")
    wants_reminder = models.BooleanField(default=False)
    wants_collect_text = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    removed_by_host_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["guest", "event"], name="one_rsvp_per_guest")]

    @property
    def is_active(self):
        return self.cancelled_at is None and self.removed_by_host_at is None


ACTIVE_RSVP = models.Q(cancelled_at__isnull=True, removed_by_host_at__isnull=True)

# Letters and numbers that can't be confused when typed (no 0/O, 1/I/L).
CLAIM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def new_claim_token():
    return secrets.token_urlsafe(32)


def new_claim_code():
    return "".join(secrets.choice(CLAIM_CODE_ALPHABET) for _ in range(6))


class PendingAttendance(models.Model):
    """
    After the event, a guest's RSVP waits here to be claimed by a new member
    within the 7-day collect window (Changes Milestone 3). Claiming records
    the attendance for that member, so their badges grow.
    """

    rsvp = models.OneToOneField(GuestRSVP, on_delete=models.CASCADE, related_name="pending")
    claim_token = models.CharField(max_length=64, unique=True, default=new_claim_token)  # for the link
    claim_code = models.CharField(max_length=6, unique=True, default=new_claim_code)  # for typing
    expires_at = models.DateTimeField()
    claimed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    claimed_at = models.DateTimeField(null=True, blank=True)


class PhoneCode(models.Model):
    """The 6-digit code texted to confirm a number. Only a keyed hash is stored; 10 minutes, 5 tries."""

    phone = models.CharField(max_length=16)
    code_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    @staticmethod
    def hash(code):
        return hmac.new(settings.SECRET_KEY.encode(), code.encode(), hashlib.sha256).hexdigest()
