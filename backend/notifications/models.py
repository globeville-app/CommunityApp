"""
Push notifications (docs/MILESTONE_4.md): device tokens and the reminders and
cancellation notices waiting to be sent.

PRIVACY: push text holds only the event title and start time, never the
meeting spot (it shows on locked screens). Tokens and texts are never logged.
"""

from django.conf import settings
from django.db import models


class PushToken(models.Model):
    """One phone's Expo push token. Removed on logout from that phone and on account deletion."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="push_tokens")
    token = models.CharField(max_length=200, unique=True)
    platform = models.CharField(max_length=10, blank=True)  # "ios" or "android"
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.platform} token for user {self.user_id}"


class ScheduledNotification(models.Model):
    """
    A reminder (the day before) or a cancellation notice for one member and
    one event. Unique per (user, event, kind), so nothing is sent twice.
    """

    class Kind(models.TextChoices):
        REMINDER = "reminder", "Reminder"
        CANCELLED = "cancelled", "Cancellation notice"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="scheduled_notifications")
    event = models.ForeignKey("events.Event", on_delete=models.CASCADE, related_name="scheduled_notifications")
    kind = models.CharField(max_length=10, choices=Kind.choices)
    send_at = models.DateTimeField()
    # Set when it was handled. `delivered` says whether a push actually went
    # out (it doesn't if the member turned it off, or has no phone registered).
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered = models.BooleanField(default=False)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "event", "kind"], name="one_notification_per_kind")]
        indexes = [models.Index(fields=["sent_at", "send_at"], name="notification_due")]

    def __str__(self):
        return f"{self.kind} for event {self.event_id}"


class JobRun(models.Model):
    """
    When a scheduled job last finished without an error, so the owner stats
    page can warn if reminders quietly stopped going out (review O8).
    """

    name = models.CharField(max_length=40, primary_key=True)
    last_ok_at = models.DateTimeField()

    @classmethod
    def record_ok(cls, name):
        from django.utils import timezone

        cls.objects.update_or_create(name=name, defaults={"last_ok_at": timezone.now()})
