"""
The 6-digit codes we email for "Confirm your email" and "Forgot password?"
(review P5 and D1).

A code is typed into the app, which is simpler on a phone than a link that
has to open the app. Each one works once, for 30 minutes, for 5 tries, and
asking for a new one replaces the old one.
"""

import json
import secrets
from datetime import timedelta
from functools import lru_cache
from pathlib import Path

from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from .models import EmailCode, language_of

LIFETIME = timedelta(minutes=30)
MAX_ATTEMPTS = 5
# Each new code allows 5 more guesses, so new codes are limited too: at most
# this many emails per account and purpose per hour.
MAX_SENDS_PER_HOUR = 5


@lru_cache(maxsize=1)
def _strings():
    """{"en": {...}, "es": {...}}: the email words live in the app's language files, under "email"."""
    result = {}
    for path in settings.LANGUAGE_FILES:
        with open(path, encoding="utf-8") as f:
            result[Path(path).stem] = json.load(f)["email"]
    return result


def send_code(user, purpose):
    """
    Make a new code for this purpose (replacing any earlier one) and email it.
    Quietly does nothing past the hourly limit, so the reply never changes.
    """
    sends_key = f"email-codes:{user.pk}:{purpose}"
    try:
        sends = cache.incr(sends_key)
    except ValueError:  # the first one this hour
        cache.set(sends_key, 1, timeout=3600)
        sends = 1
    if sends > MAX_SENDS_PER_HOUR:
        return
    code = f"{secrets.randbelow(1_000_000):06d}"
    EmailCode.objects.update_or_create(
        user=user,
        purpose=purpose,
        defaults={"code_hash": EmailCode.hash(code), "expires_at": timezone.now() + LIFETIME, "attempts": 0},
    )
    words = _strings()[language_of(user)][purpose]
    send_mail(
        subject=words["subject"].format(app=settings.APP_NAME),
        message=words["body"].format(app=settings.APP_NAME, code=code, minutes=int(LIFETIME.total_seconds() // 60)),
        from_email=None,  # DEFAULT_FROM_EMAIL
        recipient_list=[user.email or user.username],
    )


def use_code(user, purpose, code):
    """True, and the code is used up, if it's right; every wrong try counts toward the limit."""
    code = str(code or "").strip()
    with transaction.atomic():
        row = EmailCode.objects.select_for_update().filter(user=user, purpose=purpose).first()
        if row is None or row.expires_at < timezone.now() or row.attempts >= MAX_ATTEMPTS:
            return False
        if not secrets.compare_digest(row.code_hash, EmailCode.hash(code)):
            row.attempts += 1
            row.save(update_fields=["attempts"])
            return False
        row.delete()
        return True
