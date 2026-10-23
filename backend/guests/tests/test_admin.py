"""Guests in Django admin: last 4 digits only, block/unblock, read-only consents."""

from django.contrib.auth import get_user_model

from guests.models import Guest
from guests.testing import PHONE_E164, GuestTestCase


class GuestAdminTests(GuestTestCase):
    def setUp(self):
        super().setUp()
        self.rsvp(consent_collect="on")
        staff = get_user_model().objects.create_superuser(username="team@example.com", password="x")
        self.client.force_login(staff)

    def test_search_by_last_four_and_never_show_the_number(self):
        found = self.client.get("/admin/guests/guest/?q=0123")
        self.assertContains(found, "Rosa")
        self.assertContains(found, "…0123")
        self.assertNotContains(found, PHONE_E164)
        self.assertNotContains(self.client.get("/admin/guests/guest/?q=303555"), "Rosa")
        detail = self.client.get(f"/admin/guests/guest/{Guest.objects.get().pk}/change/")
        self.assertNotContains(detail, PHONE_E164)
        self.assertContains(detail, "Collect your badge")  # the consent record, read-only

    def test_block_and_unblock(self):
        guest = Guest.objects.get()
        self.client.post("/admin/guests/guest/", {"action": "block", "_selected_action": [guest.pk]})
        self.assertIsNotNone(Guest.objects.get().blocked_at)
        self.client.post("/admin/guests/guest/", {"action": "unblock", "_selected_action": [guest.pk]})
        self.assertIsNone(Guest.objects.get().blocked_at)
