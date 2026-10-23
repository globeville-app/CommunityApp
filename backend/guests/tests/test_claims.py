"""Guests who join collect the badge for the event they went to (docs/MILESTONE_5.md, "Joining and badges")."""

from datetime import timedelta
from unittest import mock

from django.utils import timezone

from badges.models import Attendance, BadgeState
from events.models import Event, Going
from events.timing import event_end
from guests.claims import make_pending_for_ended_events
from guests.models import GuestRSVP, PendingAttendance
from guests.testing import PHONE_E164, GuestTestCase


def at(when):
    return mock.patch("django.utils.timezone.now", return_value=when)


class ClaimTests(GuestTestCase):
    def setUp(self):
        super().setUp()
        self.rsvp(consent_collect="on")
        self.after = event_end(self.event) + timedelta(hours=14)
        with at(self.after):
            make_pending_for_ended_events()
        self.pending = PendingAttendance.objects.get()
        # Rosa installs the app and joins, from another neighborhood (Cy's).
        self.rosa = self.member("rosa@example.com", "Rosa", 1)
        self.as_user(self.rosa)

    def claim(self, **body):
        with at(self.after + timedelta(hours=1)):
            return self.client.post("/api/claims", body, format="json")

    def test_a_claim_by_code_records_attendance_and_grows_badges(self):
        response = self.claim(code=self.pending.claim_code.lower())  # typed in any case
        self.assertEqual(response.status_code, 201, response.data)
        attendance = Attendance.objects.get(user=self.rosa)
        self.assertEqual(attendance.event, self.event)
        self.assertEqual(attendance.neighborhood_id, 3)  # the event's neighborhood, not hers
        self.assertTrue(attendance.is_first_in_neighborhood)
        self.assertEqual(BadgeState.objects.get(user=self.rosa, badge_key="local").count, 1)
        self.assertTrue(any(c["badge_key"] == "local" for c in response.data["celebrations"]))
        self.assertEqual(Going.objects.get(user=self.rosa).source, "invite_link")

    def test_a_claim_by_link_token(self):
        self.assertEqual(self.claim(token=self.pending.claim_token).status_code, 201)

    def test_used_expired_and_unknown_claims_are_refused(self):
        self.assertEqual(self.claim(code="ZZZZZZ").data, {"code": "claim_not_found"})
        self.claim(code=self.pending.claim_code)
        self.as_user(self.ben)
        self.assertEqual(self.claim(code=self.pending.claim_code).data, {"code": "claim_used"})
        PendingAttendance.objects.update(claimed_at=None, claimed_by=None, expires_at=self.after)
        self.assertEqual(self.claim(code=self.pending.claim_code).data, {"code": "claim_expired"})

    def test_pending_guests_dont_count_for_hosting_until_they_claim(self):
        ben = self.ben
        Going.objects.create(user=ben, event=self.event)
        with at(self.after):
            from badges import engine

            engine.record_attendance(ben, self.event, "collect", now=self.after)
        self.assertIsNone(Event.objects.get(pk=self.event.pk).counted_hosted_at)  # one member + one pending guest
        self.claim(code=self.pending.claim_code)
        self.assertIsNotNone(Event.objects.get(pk=self.event.pk).counted_hosted_at)

    def test_the_collect_page_shows_the_code(self):
        page = self.web.get(f"/c/{self.pending.claim_token}")
        self.assertContains(page, self.pending.claim_code)
        self.assertContains(page, "Collect your badge on")


class GuestListTests(GuestTestCase):
    def setUp(self):
        super().setUp()
        self.rsvp()
        Going.objects.create(user=self.ben, event=self.event)
        self.as_user(self.ana)  # the host

    def test_host_sees_names_never_phone_numbers(self):
        data = self.client.get(f"/api/events/{self.event.pk}/guests").data
        self.assertEqual(data["members"], [{"display_name": "Ben R."}])
        self.assertEqual([g["first_name"] for g in data["guests"]], ["Rosa"])
        self.assertEqual(data["going_count"], 2)
        self.assertIsNone(data["came"])  # not over yet
        self.assertNotIn(PHONE_E164[-4:], str(data))

    def test_only_the_host_and_organization_admins(self):
        self.as_user(self.ben)
        self.assertEqual(self.client.get(f"/api/events/{self.event.pk}/guests").status_code, 403)

    def test_removing_a_guest(self):
        guest_id = self.client.get(f"/api/events/{self.event.pk}/guests").data["guests"][0]["id"]
        self.assertEqual(self.client.post(f"/api/events/{self.event.pk}/guests/{guest_id}/remove").status_code, 204)
        self.assertIsNotNone(GuestRSVP.objects.get().removed_by_host_at)
        self.assertEqual(self.client.get(f"/api/events/{self.event.pk}").data["going_count"], 1)

    def test_came_count_after_the_event_never_says_who_didnt_come(self):
        Event.objects.filter(pk=self.event.pk).update(
            starts_at=timezone.now() - timedelta(hours=4), ends_at=timezone.now() - timedelta(hours=2)
        )
        from badges import engine

        engine.record_attendance(self.ben, Event.objects.get(pk=self.event.pk), "collect")
        data = self.client.get(f"/api/events/{self.event.pk}/guests").data
        self.assertEqual(data["came"], {"confirmed": 1, "of": 2})
        self.assertNotIn("didnt", str(data))

    def test_sensitive_events_show_counts_only(self):
        Event.objects.filter(pk=self.event.pk).update(category="resource_fair")
        data = self.client.get(f"/api/events/{self.event.pk}/guests").data
        self.assertTrue(data["names_hidden"])
        self.assertEqual((data["members"], data["guests"], data["going_count"]), ([], [], 2))
