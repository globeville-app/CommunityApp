"""
Attendance and badges (docs/MILESTONE_3.md, data model).

PRIVACY: nothing here holds a location. An Attendance row means only "this
member went to this event"; how the phone noticed stays on the phone.
"""

from django.conf import settings
from django.db import models

from events.models import Event
from neighborhoods.models import Neighborhood


class Attendance(models.Model):
    """The ONLY thing that counts as attending. One per member per event."""

    class Method(models.TextChoices):
        AUTO = "auto", "Auto check-in"
        COLLECT = "collect", "Collected"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="attendances")
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="attendances")
    # Copied from the event, so progress can be split per neighborhood later.
    neighborhood = models.ForeignKey(Neighborhood, on_delete=models.PROTECT)
    method = models.CharField(max_length=10, choices=Method.choices)
    # Marked when recorded, so it never has to be worked out from history.
    is_first_in_neighborhood = models.BooleanField(default=False)
    user_language_at_time = models.CharField(max_length=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "event"], name="one_attendance_per_event")]


def _one_owner(name):
    """A badge belongs to a member or to an organization, never both or neither."""
    return models.CheckConstraint(
        condition=models.Q(user__isnull=False, organization__isnull=True)
        | models.Q(user__isnull=True, organization__isnull=False),
        name=name,
    )


class BadgeState(models.Model):
    """
    A growth badge of a member or (Milestone 4) an organization. `stage` is
    the highest reached and never goes down.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name="badge_states"
    )
    organization = models.ForeignKey(
        "organizations.Organization", null=True, blank=True, on_delete=models.CASCADE, related_name="badge_states"
    )
    badge_key = models.CharField(max_length=30)
    count = models.PositiveIntegerField(default=0)  # the current qualifying count
    stage = models.PositiveSmallIntegerField(default=0)  # 0 = not earned, 1-5 = Seed-Grove
    grove_milestones_celebrated = models.PositiveSmallIntegerField(default=0)
    earned_at = models.DateTimeField(null=True, blank=True)  # when it first reached Seed
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "badge_key"], condition=models.Q(user__isnull=False), name="one_state_per_badge"
            ),
            models.UniqueConstraint(
                fields=["organization", "badge_key"],
                condition=models.Q(organization__isnull=False),
                name="one_org_state_per_badge",
            ),
            _one_owner("badge_state_has_one_owner"),
        ]


class Keepsake(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name="keepsakes"
    )
    organization = models.ForeignKey(
        "organizations.Organization", null=True, blank=True, on_delete=models.CASCADE, related_name="keepsakes"
    )
    badge_key = models.CharField(max_length=30)
    earned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "badge_key"], condition=models.Q(user__isnull=False), name="one_keepsake_each"
            ),
            models.UniqueConstraint(
                fields=["organization", "badge_key"],
                condition=models.Q(organization__isnull=False),
                name="one_org_keepsake_each",
            ),
            _one_owner("keepsake_has_one_owner"),
        ]


class Celebration(models.Model):
    """An unlock moment waiting to be shown the next time the app opens."""

    class Kind(models.TextChoices):
        EARNED = "earned", "Earned"
        STAGE_UP = "stage_up", "Stage up"
        GROVE_MILESTONE = "grove_milestone", "Grove milestone"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="celebrations")
    badge_key = models.CharField(max_length=30)
    kind = models.CharField(max_length=20, choices=Kind.choices)
    stage = models.PositiveSmallIntegerField(default=0)
    count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    seen_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["created_at", "id"]


class ShareLog(models.Model):
    """That a badge was shared, for counting. No member, no destination."""

    badge_key = models.CharField(max_length=30)
    date = models.DateField(auto_now_add=True)


class DeclineLog(models.Model):
    """That someone tapped "I didn't make it", for the owner stats. No member, no event."""

    date = models.DateField(auto_now_add=True)
