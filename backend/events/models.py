"""
Neighborhood calendar (docs/MILESTONE_2.md).

PRIVACY: no member's home address is stored. The organizer types where the
event meets, and neighbors of the same neighborhood can see it. Who is going
is stored (for later badges) but never shown, only the count.
"""

from django.conf import settings
from django.db import models

from neighborhoods.models import Neighborhood

from .categories import ALL_CATEGORY_KEYS, OTHER_MAX_LENGTH

TITLE_MAX = 80
DESCRIPTION_MAX = 2000
LOCATION_MAX = 120
LANGUAGE_CHOICES = [("en", "English"), ("es", "Español")]


class Event(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        CANCELLED = "cancelled", "Cancelled"

    neighborhood = models.ForeignKey(Neighborhood, on_delete=models.PROTECT, related_name="events")
    # Blank once the organizer deletes their account; the app then shows
    # "Former neighbor" (see accounts/views.py, DeleteAccountView).
    organizer = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="organized_events"
    )
    # Milestone 4: posted as an organization ("Hosted by ..."). The organizer
    # above is then the admin who posted it, visible to the team only.
    organization = models.ForeignKey(
        "organizations.Organization", null=True, blank=True, on_delete=models.PROTECT, related_name="events"
    )
    category = models.CharField(max_length=40, choices=[(key, key) for key in ALL_CATEGORY_KEYS])
    category_other = models.CharField(max_length=OTHER_MAX_LENGTH, blank=True)

    title = models.CharField(max_length=TITLE_MAX)
    description = models.TextField(max_length=DESCRIPTION_MAX, blank=True)
    # The language the organizer wrote in, and optional text in the other one.
    language = models.CharField(max_length=2, choices=LANGUAGE_CHOICES, default="en")
    title_alt = models.CharField(max_length=TITLE_MAX, blank=True)
    description_alt = models.TextField(max_length=DESCRIPTION_MAX, blank=True)

    # Stored in UTC; the app shows and enters them in Denver time.
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    location_text = models.CharField(max_length=LOCATION_MAX)
    # The map pin: where the event meets (never anyone's home). Required for
    # new and edited events from Milestone 3; older events may have none.
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    partiful_url = models.URLField(blank=True)
    # A seam for sponsorships later. Not settable or readable through the API.
    sponsor_name = models.CharField(max_length=100, blank=True)

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)

    class Visibility(models.TextChoices):
        # On the neighborhood calendar, and open to anyone with the invite link.
        NEIGHBORHOOD = "neighborhood", "Neighborhood + link"
        # Never on any calendar or list; only people with the link (Milestone 5).
        LINK_ONLY = "link_only", "Link only"

    visibility = models.CharField(max_length=12, choices=Visibility.choices, default=Visibility.NEIGHBORHOOD)
    # When the event first had 2 counted attendees, so it counts as hosted
    # (docs/BADGES.md). Kept even if attendees later delete their accounts.
    counted_hosted_at = models.DateTimeField(null=True, blank=True)
    # True if this was its organizer's first event to count as hosted (Day One).
    is_hosts_first_counted = models.BooleanField(default=False)
    # Resource fairs and donation drives: how many neighbors confirmed they
    # went. Who they were is never stored (review D4), so this count is all
    # the host's credit is based on.
    anonymous_attendee_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["starts_at"]
        indexes = [
            # Later features count events by category per neighborhood.
            models.Index(fields=["neighborhood", "category", "starts_at"], name="event_nbhd_cat_start"),
        ]

    def __str__(self):
        return self.title


class Going(models.Model):
    """One "I'm going" per member per event. Undoing it deletes the row."""

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="goings")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="goings")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["event", "user"], name="one_going_per_user_per_event")]


class EventReport(models.Model):
    """A member flagged an event for the team to look at, in Django admin."""

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="reports")
    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    reason = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class TranslationCache(models.Model):
    """A machine translation of one field, kept until the event is edited."""

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="translations")
    field = models.CharField(max_length=20)  # "title" or "description"
    target_language = models.CharField(max_length=2, choices=LANGUAGE_CHOICES)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["event", "field", "target_language"], name="one_translation_per_field")
        ]


# ---- Invite links (docs/MILESTONE_5.md) ------------------------------------------

# No 0/O/o or 1/l/I, so a code read aloud or typed from a text is never ambiguous.
INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
INVITE_CODE_LENGTH = 10


def new_invite_code():
    import secrets

    return "".join(secrets.choice(INVITE_ALPHABET) for _ in range(INVITE_CODE_LENGTH))


class InviteLink(models.Model):
    """
    https://globeville.app/e/{code}: anyone holding it can see the event
    (Changes Milestone 2). Resetting the link revokes this one and makes a
    new one; the old code then shows "This invite link has expired".
    """

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="invite_links")
    code = models.CharField(max_length=INVITE_CODE_LENGTH, unique=True, default=new_invite_code)
    created_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    @classmethod
    def current(cls, event):
        """The event's working link, made if it has none (every event has one)."""
        link = cls.objects.filter(event=event, revoked_at__isnull=True).order_by("-created_at").first()
        return link or cls.objects.create(event=event)


class EventAccess(models.Model):
    """
    A member opened the event's invite link, so they can see it and use it
    like a neighbor (detail, I'm going, collect, check-in), whatever their
    neighborhood. Resetting the link doesn't take this away.
    """

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="event_access")
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="access")
    via_invite = models.ForeignKey(InviteLink, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "event"], name="one_access_per_member")]
