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

    @property
    def display_name(self):
        return f"{self.first_name} {self.last_initial}."

    def __str__(self):
        return self.display_name
