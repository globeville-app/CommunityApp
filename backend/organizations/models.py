"""
Organization profiles (docs/MILESTONE_4.md): churches, rec centers, schools,
clubs, food banks, businesses... with their own page, events, followers and
badges, run by 1-5 members acting as admins.

An organization is never its own login. It goes live only after the team
approves it in Django admin, and so do later changes to its name, type or
neighborhoods.
"""

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from neighborhoods.models import Neighborhood

NAME_MAX = 60
DESCRIPTION_MAX = 500
MAX_ADMINS = 5

# The type keys. The app shows labels from en.json / es.json
# (organizations.types.<key>). Every type works the same way.
TYPES = ["nonprofit", "club", "collective", "faith", "school", "civic", "business"]

# Shown on the approval screen and the business posting screen (English;
# the app shows its own translated copy).
BUSINESS_RULE = (
    "Businesses may post real events people attend (a tasting, a workshop, a "
    "game night), never sales, discounts or ads."
)


def validate_https(value):
    """The same rule as the app's form (views.clean_link), so admin edits follow it too."""
    if value and not value.lower().startswith("https://"):
        raise ValidationError("The link must start with https://")


def random_org_photo_path(instance, filename):
    """A random name, like profile photos; the original filename is thrown away."""
    extension = ".png" if filename.lower().endswith(".png") else ".jpg"
    return f"organization_photos/{uuid.uuid4().hex}{extension}"


class Organization(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending approval"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        # No admins left: nobody can see the page until the team assigns one.
        HIDDEN = "hidden", "Hidden (no admin)"

    name = models.CharField(max_length=NAME_MAX)  # never translated
    type = models.CharField(max_length=12, choices=[(key, key) for key in TYPES])
    description = models.TextField(max_length=DESCRIPTION_MAX, blank=True)
    # An optional version in the other language, written by an admin.
    description_alt = models.TextField(max_length=DESCRIPTION_MAX, blank=True)
    language = models.CharField(max_length=2, choices=[("en", "English"), ("es", "Español")], default="en")
    photo = models.ImageField(upload_to=random_org_photo_path, blank=True)
    link = models.URLField(max_length=200, blank=True, validators=[validate_https])
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    # Team only; never shown to members in this milestone.
    rejection_reason = models.TextField(blank=True)
    neighborhoods = models.ManyToManyField(Neighborhood, through="OrganizationNeighborhood", related_name="organizations")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def is_admin(self, user):
        return self.admins.filter(user=user).exists()


class OrganizationNeighborhood(models.Model):
    """A neighborhood the organization serves (at least one)."""

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)
    neighborhood = models.ForeignKey(Neighborhood, on_delete=models.PROTECT)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["organization", "neighborhood"], name="one_row_per_served_neighborhood")]


class OrganizationAdmin(models.Model):
    """A member who runs the organization. They can live in any Denver neighborhood."""

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="admins")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="organization_roles")
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["organization", "user"], name="one_admin_row_per_member")]

    def __str__(self):
        return f"admin of {self.organization}"


class OrganizationChangeRequest(models.Model):
    """A new name, type or neighborhoods, waiting for the team."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="change_requests")
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    # Blank / empty = unchanged.
    name = models.CharField(max_length=NAME_MAX, blank=True)
    type = models.CharField(max_length=12, blank=True, choices=[(key, key) for key in TYPES])
    neighborhood_ids = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    rejection_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"change to {self.organization}"


class Follow(models.Model):
    """Private: nobody sees who follows; admins see only the count."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="follows")
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="follows")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "organization"], name="one_follow_per_pair")]


class OrganizationReport(models.Model):
    """A member reports an organization (same flow as event reports)."""

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="reports")
    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    reason = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)


class OrganizationTranslation(models.Model):
    """A cached machine translation of the description; cleared when it's edited."""

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="translations")
    target_language = models.CharField(max_length=2)
    text = models.TextField()
