"""Texts waiting to be sent to guests, and the ones already sent (with their cost)."""

from django.db import models


class ScheduledText(models.Model):
    """
    One text to one guest. Reminders, cancellations and collect texts wait
    here for the 15-minute job; a code is sent straight away and recorded
    here for the counts and the budget (its digits are never stored).
    """

    class Kind(models.TextChoices):
        CODE = "code", "Sign-in code"
        REMINDER = "reminder", "Reminder"
        CANCELLED = "cancelled", "Cancellation"
        COLLECT = "collect", "Collect your badge"

    guest = models.ForeignKey("guests.Guest", on_delete=models.CASCADE, related_name="texts")
    event = models.ForeignKey("events.Event", null=True, blank=True, on_delete=models.CASCADE, related_name="texts")
    kind = models.CharField(max_length=10, choices=Kind.choices)
    send_at = models.DateTimeField()
    sent_at = models.DateTimeField(null=True, blank=True)
    # Why it was never sent: opted_out, budget, rsvp_cancelled, event_cancelled, blocked, failed.
    skipped_reason = models.CharField(max_length=20, blank=True)
    provider_message_id = models.CharField(max_length=64, blank=True)
    cost_usd = models.DecimalField(max_digits=8, decimal_places=4, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            # One reminder, cancellation and collect per guest per event; codes can repeat.
            models.UniqueConstraint(
                fields=["guest", "event", "kind"],
                condition=~models.Q(kind="code"),
                name="one_text_per_kind",
            )
        ]
        indexes = [models.Index(fields=["sent_at", "send_at"], name="text_due")]
