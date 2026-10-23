"""
A guest RSVPs from the web page (docs/MILESTONE_5.md, "Guests and consent"):

  1. start(): first name, US mobile number and the consents. We text a
     6-digit code and hand back a signed "pending" note for step 2.
  2. verify(): the code is right, so we record the consents (append-only),
     the RSVP, and the texts they asked for.

Plus cancelling (the guest's "Can't make it"), removal by the host, and
what happens to guest texts when an event is cancelled or moved.

PRIVACY: phone numbers are never logged or shown; errors are codes only.
"""

import secrets
from datetime import timedelta

from django.core import signing
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone
from rest_framework import status

from config.errors import ApiError
from texting import sending
from texting.models import ScheduledText

from .models import (
    ACTIVE_RSVP,
    CONSENT_VERSION,
    FIRST_NAME_MAX,
    Guest,
    GuestConsent,
    GuestRSVP,
    PendingAttendance,
    PhoneCode,
)
from .phones import NotUSNumber, normalize_us

CODE_LIFETIME = timedelta(minutes=10)
MAX_CODE_TRIES = 5
PENDING_SALT = "guest-rsvp-pending"
PENDING_MAX_AGE = 30 * 60  # the verify step must follow within 30 minutes

# Abuse limits (counted in the database cache in production).
MAX_GUESTS_PER_EVENT = 200
MAX_RSVPS_PER_PHONE_PER_DAY = 5
MAX_CODES_PER_PHONE_PER_HOUR = 3
MAX_CODES_PER_PHONE_PER_DAY = 10
MAX_ATTEMPTS_PER_IP_PER_HOUR = 30


def going_guests(event):
    return GuestRSVP.objects.filter(ACTIVE_RSVP, event=event)


def _count_attempt(ip):
    """Counts this IP address's RSVP tries this hour; True if over the limit."""
    key = f"guest-rsvp-ip:{ip}"
    try:
        tries = cache.incr(key)
    except ValueError:  # the first one this hour
        cache.set(key, 1, timeout=3600)
        tries = 1
    return tries > MAX_ATTEMPTS_PER_IP_PER_HOUR


def start(event, *, first_name, phone, consent_event_texts, consent_collect, wants_reminder, language, ip, now=None):
    """Checks everything, texts the code, and returns the signed note for verify()."""
    from events.timing import has_ended

    now = now or timezone.now()
    if _count_attempt(ip):
        raise ApiError("rate_limited", status_code=status.HTTP_429_TOO_MANY_REQUESTS)
    if event.status == event.Status.CANCELLED or has_ended(event, now):
        raise ApiError("event_closed", status_code=status.HTTP_409_CONFLICT)
    if not consent_event_texts:
        raise ApiError("consent_required")
    first_name = str(first_name or "").strip()
    if not first_name:
        raise ApiError("first_name_required")
    if len(first_name) > FIRST_NAME_MAX:
        raise ApiError("first_name_too_long")
    try:
        phone = normalize_us(phone)
    except NotUSNumber:
        raise ApiError("phone_not_us") from None
    if going_guests(event).count() >= MAX_GUESTS_PER_EVENT:
        raise ApiError("guest_limit", status_code=status.HTTP_409_CONFLICT)

    guest, _ = Guest.objects.get_or_create(phone=phone, defaults={"first_name": first_name, "language": language})
    if guest.blocked_at:
        raise ApiError("phone_blocked", status_code=status.HTTP_403_FORBIDDEN)
    if guest.opted_out_at:
        # They replied STOP; the page explains how to reply START.
        raise ApiError("phone_opted_out", status_code=status.HTTP_403_FORBIDDEN)
    if guest.rsvps.filter(created_at__gte=now - timedelta(days=1)).count() >= MAX_RSVPS_PER_PHONE_PER_DAY:
        raise ApiError("rate_limited", status_code=status.HTTP_429_TOO_MANY_REQUESTS)
    codes = ScheduledText.objects.filter(guest=guest, kind=ScheduledText.Kind.CODE)
    if (
        codes.filter(created_at__gte=now - timedelta(hours=1)).count() >= MAX_CODES_PER_PHONE_PER_HOUR
        or codes.filter(created_at__gte=now - timedelta(days=1)).count() >= MAX_CODES_PER_PHONE_PER_DAY
    ):
        raise ApiError("rate_limited", status_code=status.HTTP_429_TOO_MANY_REQUESTS)

    code = f"{secrets.randbelow(1_000_000):06d}"
    with transaction.atomic():
        PhoneCode.objects.filter(phone=phone).delete()  # a new code replaces the old one
        PhoneCode.objects.create(phone=phone, code_hash=PhoneCode.hash(code), expires_at=now + CODE_LIFETIME)
    try:
        sending.send_code(guest, code, now)
    except sending.TextUnavailable:
        raise ApiError("texting_unavailable", status_code=status.HTTP_503_SERVICE_UNAVAILABLE) from None
    return signing.dumps(
        {
            "event": event.pk,
            "phone": phone,
            "first_name": first_name,
            "collect": bool(consent_collect),
            "reminder": bool(wants_reminder),
            "language": language,
        },
        salt=PENDING_SALT,
    )


def read_pending(token, event):
    try:
        pending = signing.loads(token, salt=PENDING_SALT, max_age=PENDING_MAX_AGE)
    except signing.BadSignature:
        raise ApiError("code_expired") from None
    if pending.get("event") != event.pk:
        raise ApiError("code_expired")
    return pending


def _check_code(phone, code, now):
    """Uses the code up if it's right. A wrong try is counted (and saved) before the error."""
    error = None
    with transaction.atomic():
        row = PhoneCode.objects.select_for_update().filter(phone=phone).first()
        if row is None or row.expires_at < now:
            error = "code_expired"
        elif row.attempts >= MAX_CODE_TRIES:
            error = "too_many_attempts"
        elif not secrets.compare_digest(row.code_hash, PhoneCode.hash(str(code or "").strip())):
            row.attempts += 1
            row.save(update_fields=["attempts"])
            error = "too_many_attempts" if row.attempts >= MAX_CODE_TRIES else "code_invalid"
        else:
            row.delete()
    # Raised outside the transaction, so the counted try isn't undone.
    if error == "too_many_attempts":
        raise ApiError(error, status_code=status.HTTP_429_TOO_MANY_REQUESTS)
    if error:
        raise ApiError(error)


def verify(event, pending_token, code, now=None):
    """The code is right: record consents, the RSVP and the texts asked for. Returns the RSVP."""
    now = now or timezone.now()
    pending = read_pending(pending_token, event)
    _check_code(pending["phone"], code, now)
    with transaction.atomic():
        guest = Guest.objects.select_for_update().get(phone=pending["phone"])
        guest.first_name = pending["first_name"]
        guest.language = pending["language"]
        guest.phone_verified_at = now
        guest.save(update_fields=["first_name", "language", "phone_verified_at"])
        # Proof of consent: new rows every time, never edited.
        GuestConsent.objects.create(
            guest=guest, kind=GuestConsent.Kind.EVENT_TEXTS, consent_version=CONSENT_VERSION, language=guest.language
        )
        if pending["collect"]:
            GuestConsent.objects.create(
                guest=guest, kind=GuestConsent.Kind.COLLECT_TEXTS, consent_version=CONSENT_VERSION, language=guest.language
            )
        already_going = going_guests(event).filter(guest=guest).exists()
        if not already_going and going_guests(event).count() >= MAX_GUESTS_PER_EVENT:
            raise ApiError("guest_limit", status_code=status.HTTP_409_CONFLICT)
        rsvp, _ = GuestRSVP.objects.get_or_create(guest=guest, event=event)
        if rsvp.removed_by_host_at:
            raise ApiError("rsvp_removed", status_code=status.HTTP_403_FORBIDDEN)
        rsvp.cancelled_at = None
        rsvp.wants_reminder = pending["reminder"]
        rsvp.wants_collect_text = pending["collect"]
        rsvp.save()
        schedule_texts(rsvp, now)
    return rsvp


def schedule_texts(rsvp, now):
    """The reminder (5 PM the day before) and collect text (10 AM after), if chosen."""
    from notifications.scheduling import reminder_time

    unsent = ScheduledText.objects.filter(guest=rsvp.guest, event=rsvp.event, sent_at__isnull=True)
    if rsvp.wants_reminder and reminder_time(rsvp.event) > now:
        unsent.filter(kind=ScheduledText.Kind.REMINDER).update(skipped_reason="")
        sending.schedule(rsvp.guest, rsvp.event, ScheduledText.Kind.REMINDER, reminder_time(rsvp.event))
    else:
        unsent.filter(kind=ScheduledText.Kind.REMINDER).delete()
    if rsvp.wants_collect_text:
        unsent.filter(kind=ScheduledText.Kind.COLLECT).update(skipped_reason="")
        sending.schedule(rsvp.guest, rsvp.event, ScheduledText.Kind.COLLECT, sending.collect_time(rsvp.event))
    else:
        unsent.filter(kind=ScheduledText.Kind.COLLECT).delete()


def _drop_texts_and_claim(rsvp):
    ScheduledText.objects.filter(guest=rsvp.guest, event=rsvp.event, sent_at__isnull=True).delete()
    PendingAttendance.objects.filter(rsvp=rsvp, claimed_at__isnull=True).delete()


def cancel(rsvp, now=None):
    """The guest's "Can't make it": the RSVP and any texts still waiting go."""
    with transaction.atomic():
        rsvp.cancelled_at = now or timezone.now()
        rsvp.save(update_fields=["cancelled_at"])
        _drop_texts_and_claim(rsvp)


def remove_by_host(rsvp, now=None):
    with transaction.atomic():
        rsvp.removed_by_host_at = now or timezone.now()
        rsvp.save(update_fields=["removed_by_host_at"])
        _drop_texts_and_claim(rsvp)


def event_cancelled(event, now=None):
    """Every guest going gets a cancellation text (held to 9 AM in quiet hours); reminders and collects go."""
    now = now or timezone.now()
    ScheduledText.objects.filter(
        event=event, kind__in=[ScheduledText.Kind.REMINDER, ScheduledText.Kind.COLLECT], sent_at__isnull=True
    ).delete()
    for rsvp in going_guests(event).select_related("guest"):
        text = sending.schedule(rsvp.guest, event, ScheduledText.Kind.CANCELLED, now)
        if text.send_at <= now:
            sending.send_text(text, now)


def event_time_changed(event, now=None):
    """The host moved the event: unsent reminders and collect texts move with it."""
    from notifications.scheduling import reminder_time

    now = now or timezone.now()
    for rsvp in going_guests(event).select_related("guest"):
        schedule_texts(rsvp, now)
    unsent = ScheduledText.objects.filter(event=event, sent_at__isnull=True, skipped_reason="")
    if reminder_time(event) > now:
        unsent.filter(kind=ScheduledText.Kind.REMINDER).update(send_at=sending.outside_quiet_hours(reminder_time(event)))
    else:
        unsent.filter(kind=ScheduledText.Kind.REMINDER).delete()
    unsent.filter(kind=ScheduledText.Kind.COLLECT).update(send_at=sending.collect_time(event))
