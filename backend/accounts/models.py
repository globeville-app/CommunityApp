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

    def __str__(self):
        return f"{self.user} ({self.language})"


def language_of(user):
    account = Account.objects.filter(user=user).first()
    return account.language if account else settings.DEFAULT_LANGUAGE_CODE


def set_language(user, language):
    Account.objects.update_or_create(user=user, defaults={"language": language})
