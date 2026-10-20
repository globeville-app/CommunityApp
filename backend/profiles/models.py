import uuid

from django.conf import settings
from django.db import models

from neighborhoods.models import Neighborhood


def random_photo_path(instance, filename):
    """
    Store photos under a random name, e.g. profile_photos/3f2a...9c.jpg.
    The original filename (which might be "ana_at_home.jpg") is thrown away.
    """
    extension = ".png" if filename.lower().endswith(".png") else ".jpg"
    return f"profile_photos/{uuid.uuid4().hex}{extension}"


class Profile(models.Model):
    """
    A person's public profile.

    PRIVACY: there is deliberately no field for a street address, coordinates,
    or anything the geocoder sent back. Only the neighborhood is kept.
    """

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    first_name = models.CharField(max_length=50)
    # Only the initial of the last name is kept: "Ana R."
    last_initial = models.CharField(max_length=1)
    photo = models.ImageField(upload_to=random_photo_path, blank=True)
    # Event category keys (events/categories.py), e.g. ["gardening"]: 0-8,
    # no duplicates, never "other". The app shows them in the person's language.
    interests = models.JSONField(default=list, blank=True)
    neighborhood = models.ForeignKey(Neighborhood, on_delete=models.PROTECT)
    # The local name the person picked, e.g. "LoHi" for Highland. Blank = official name.
    alias = models.CharField(max_length=100, blank=True)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Role(models.TextChoices):
        MEMBER = "member", "Member"
        ORGANIZER = "organizer", "Organizer"

    # Becomes "organizer" when the member posts their first event.
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.MEMBER)

    # Milestone 3: auto check-in (the phone notices arriving; the server only
    # hears "attended event X") and who can see this member's badges.
    auto_checkin = models.BooleanField(default=False)

    class BadgeVisibility(models.TextChoices):
        NEIGHBORHOOD = "neighborhood", "My neighborhood"
        PRIVATE = "private", "Only me"

    badge_visibility = models.CharField(
        max_length=12, choices=BadgeVisibility.choices, default=BadgeVisibility.NEIGHBORHOOD
    )
    # The auto check-in offer is shown once, and re-offered at most once, ever.
    checkin_offer_shown_at = models.DateTimeField(null=True, blank=True)
    checkin_reoffer_shown_at = models.DateTimeField(null=True, blank=True)

    # Milestone 4: push notifications are opt-in. Reminders are off until the
    # member says yes; cancellation alerts are on once the phone allows
    # notifications (it registers a push token only after that).
    reminders_enabled = models.BooleanField(default=False)
    cancellation_alerts_enabled = models.BooleanField(default=True)
    # The one-time "Get a reminder the day before?" ask.
    notif_offer_shown_at = models.DateTimeField(null=True, blank=True)

    @property
    def display_name(self):
        return f"{self.first_name} {self.last_initial}."

    def __str__(self):
        return self.display_name


class Block(models.Model):
    """
    "Block this member" (Apple's rule for apps where people post; review P6).
    The blocker stops seeing the blocked member's own events. It's one-way and
    silent: the blocked member is never told, and nothing else changes for them.
    """

    blocker = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="blocks")
    blocked = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="blocked_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["blocker", "blocked"], name="one_block_per_pair")]
