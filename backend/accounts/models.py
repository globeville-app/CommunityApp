import hashlib
import hmac

from django.conf import settings
from django.db import models


class Account(models.Model):
    """
    Settings that belong to the person from the moment they sign up.

    The language lives here rather than on Profile because the profile is
    only created at the end of the join flow, and the language has to be
    saved at signup (docs/LANGUAGE.md). The profile API reads and writes it.
    """

    LANGUAGE_CHOICES = [("en", "English"), ("es", "Español")]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    language = models.CharField(max_length=2, choices=LANGUAGE_CHOICES, default="en")
    # When the member last used the app (GO_LIVE.md, owner stats). Only a
    # timestamp: no location, screens or devices. Updated at most hourly.
    last_seen_at = models.DateTimeField(null=True, blank=True)
    # New signups confirm their email with a 6-digit code before using the
    # app (review D1). Accounts from before this rule count as confirmed.
    email_verified = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.user} ({self.language})"


def language_of(user):
    account = Account.objects.filter(user=user).first()
    return account.language if account else settings.DEFAULT_LANGUAGE_CODE


def set_language(user, language):
    Account.objects.update_or_create(user=user, defaults={"language": language})


class EmailCode(models.Model):
    """
    A 6-digit code we emailed, to confirm an email address or reset a
    password. Only a keyed hash of the code is stored; it works once, for a
    short time, and only for a few tries.
    """

    class Purpose(models.TextChoices):
        VERIFY = "verify", "Confirm email"
        RESET = "reset", "Reset password"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="email_codes")
    purpose = models.CharField(max_length=10, choices=Purpose.choices)
    code_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "purpose"], name="one_code_per_purpose")]

    @staticmethod
    def hash(code):
        return hmac.new(settings.SECRET_KEY.encode(), code.encode(), hashlib.sha256).hexdigest()


class DeviceToken(models.Model):
    """
    One login per phone (review P15). The app sends "Authorization: Token
    <key>"; only a hash of the key is stored, so a copy of the database
    can't be used to sign in. Logging out ends this phone's login only; a
    password reset ends them all. A login unused for 90 days stops working.
    """

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="device_tokens")
    key_hash = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(auto_now_add=True)

    @staticmethod
    def hash(key):
        return hashlib.sha256(key.encode()).hexdigest()

    @classmethod
    def issue(cls, user):
        """A new login for a phone. Returns the key, which is never stored."""
        import secrets

        key = secrets.token_hex(20)
        cls.objects.create(user=user, key_hash=cls.hash(key))
        return key
