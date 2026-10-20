"""
New members confirm their email before using the app (review D1).

Added to every view by default (config/settings.py). The few views an
unconfirmed member still needs (confirming, sending a new code, logging out,
deleting the account, saving their language) say so with `allow_unverified`:
True for every method, or a set of methods such as {"PATCH"}.
"""

from django.conf import settings
from rest_framework.permissions import BasePermission

from .models import Account


class EmailVerified(BasePermission):
    code = "email_not_verified"
    message = "email_not_verified"

    def has_permission(self, request, view):
        if not settings.REQUIRE_EMAIL_VERIFICATION or not request.user or not request.user.is_authenticated:
            return True
        allowed = getattr(view, "allow_unverified", False)
        if allowed is True or (allowed and request.method in allowed):
            return True
        return not Account.objects.filter(user=request.user, email_verified=False).exists()
