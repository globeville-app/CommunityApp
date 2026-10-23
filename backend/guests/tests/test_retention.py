"""Guests' phone numbers are deleted on schedule (docs/MILESTONE_5.md, "Phone numbers")."""

from datetime import timedelta

from django.utils import timezone

from accounts.retention import cleanup
from guests.models import Guest, GuestRSVP, PendingAttendance
from guests.testing import GuestTestCase
from texting.models import ScheduledText


class GuestRetentionTests(GuestTestCase):
    def setUp(self):
        super().setUp()
        self.rsvp()
        self.later = timezone.now() + timedelta(days=60)

    def test_deleted_30_days_after_the_last_text(self):
        cleanup(timezone.now() + timedelta(days=20))
        self.assertTrue(Guest.objects.exists())  # the event hasn't even happened yet
        ScheduledText.objects.update(send_at=timezone.now() - timedelta(days=31))
        from events.models import Event

        Event.objects.update(starts_at=timezone.now() - timedelta(days=40), ends_at=timezone.now() - timedelta(days=40))
        cleanup(timezone.now())
        self.assertFalse(Guest.objects.exists())

    def test_kept_while_another_rsvp_is_coming(self):
        ScheduledText.objects.update(send_at=timezone.now() - timedelta(days=31))
        cleanup(timezone.now())
        self.assertTrue(Guest.objects.exists())  # the potluck is still ahead

    def test_kept_if_they_joined(self):
        from events.models import Event

        Event.objects.update(starts_at=timezone.now() - timedelta(days=40), ends_at=timezone.now() - timedelta(days=40))
        PendingAttendance.objects.create(
            rsvp=GuestRSVP.objects.get(), expires_at=timezone.now(), claimed_at=timezone.now(), claimed_by=self.ben
        )
        ScheduledText.objects.update(send_at=timezone.now() - timedelta(days=31))
        cleanup(timezone.now())
        self.assertTrue(Guest.objects.exists())
