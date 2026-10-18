"""
Problem reports sent from the app's "Report a problem" form.

PRIVACY: a report holds only what the person typed, plus a few technical
details (app version, phone model, language, which screen). Never an address,
location or contacts. Screenshots are kept in a private folder that the app
can never download; only staff can see them, through the Django admin.
"""

import os
import uuid

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.db import models
from django.utils.deconstruct import deconstructible


@deconstructible
class PrivateStorage(FileSystemStorage):
    """
    Files in PRIVATE_MEDIA_ROOT, outside MEDIA_ROOT on purpose: anything in
    MEDIA_ROOT is served at /media/ during development, and screenshots must
    never be served to the app. The folder is read from settings each time,
    so tests can point it at a temporary folder.
    """

    @property
    def base_location(self):
        return settings.PRIVATE_MEDIA_ROOT

    @property
    def location(self):
        return os.path.abspath(self.base_location)


def private_storage():
    """
    Where screenshots go: the "private" storage from settings.STORAGES, a
    folder on disk in development and a private Spaces folder in production.
    """
    from django.core.files.storage import storages

    return storages["private"]


def random_screenshot_path(instance, filename):
    """A random name, like profile photos; the original filename is dropped."""
    extension = ".png" if filename.lower().endswith(".png") else ".jpg"
    return f"problem_screenshots/{uuid.uuid4().hex}{extension}"


class ProblemReport(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "New"
        IN_PROGRESS = "in_progress", "In progress"
        RESOLVED = "resolved", "Resolved"

    # Blank for people who weren't signed in. Set to blank (not deleted) when
    # a member deletes their account, so the team can still fix the bug.
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    # Only asked for when the person isn't signed in.
    contact_email = models.EmailField(blank=True)
    message = models.TextField(max_length=1000)
    screenshot = models.ImageField(upload_to=random_screenshot_path, storage=private_storage, blank=True)

    # Technical details the app attaches automatically.
    app_version = models.CharField(max_length=40, blank=True)
    os = models.CharField(max_length=60, blank=True)
    device_model = models.CharField(max_length=100, blank=True)
    language = models.CharField(max_length=2, blank=True)
    screen = models.CharField(max_length=60, blank=True)

    # For the team, in the admin.
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NEW)
    team_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"#{self.pk} {self.message[:40]}"
