"""Test helper: confirm a new member's email with the code we "sent" (Django keeps test emails in mail.outbox)."""

import re

from django.core import mail


def latest_code():
    return re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)


def confirm_email(client):
    """For a client already logged in as a member who just signed up."""
    response = client.post("/api/account/verify-email", {"code": latest_code()}, format="json")
    assert response.status_code == 204, response.content
