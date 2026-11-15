"""
Telling a member they were invited to help run an organization: a push to
their phones and an email, in their language. Only the organization's name
(public in the app), never who invited them. Neither can fail the invite:
the invitation is saved, and the member still sees it under Settings →
Your organizations.
"""

import json
import logging
from functools import lru_cache
from pathlib import Path

from django.conf import settings
from django.core.mail import send_mail

from accounts.models import language_of

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _strings():
    """{"en": {"push": ..., "email": ...}, "es": {...}}, from the app's language files."""
    result = {}
    for path in settings.LANGUAGE_FILES:
        with open(path, encoding="utf-8") as f:
            words = json.load(f)
        result[Path(path).stem] = {"push": words["push"], "email": words["email"]}
    return result


def invite_received(invite):
    from notifications.push import PushUnavailable, send_to_user

    user = invite.user
    words = _strings()[language_of(user)]
    name = invite.organization.name
    try:
        send_to_user(user, words["push"]["org_invite"].format(org=name), {"kind": "org_invite"})
    except PushUnavailable:
        pass  # the email and the in-app list still tell them
    except Exception as error:
        logger.error("Invite push failed with %s", type(error).__name__)
    email = words["email"]["org_invite"]
    try:
        send_mail(
            subject=email["subject"].format(app=settings.APP_NAME, org=name),
            message=email["body"].format(app=settings.APP_NAME, org=name),
            from_email=None,  # DEFAULT_FROM_EMAIL
            recipient_list=[user.email or user.username],
        )
    except Exception as error:
        logger.error("Invite email failed with %s", type(error).__name__)
