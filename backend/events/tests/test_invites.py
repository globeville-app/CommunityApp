"""Invite links and who can see an event (docs/MILESTONE_5.md, steps 1-2)."""

from datetime import timedelta

from django.test import override_settings
from django.utils import timezone

from badges import engine
from badges.models import Attendance
from events.models import INVITE_ALPHABET, Event, EventAccess, Going, InviteLink
from events.tests.helpers import EventTestCase
from events.timing import event_end


@override_settings(PUBLIC_BASE_URL="https://globeville.app")
class InviteLinkTests(EventTestCase):
    def setUp(self):
        super().setUp()
        self.as_user(self.ana)
        self.event_id = self.post_event(title="Block party").data["id"]

    def test_every_new_event_has_a_link_and_a_message_in_the_hosts_language(self):
        link = InviteLink.objects.get(event_id=self.event_id)
        self.assertEqual(len(link.code), 10)
        self.assertTrue(set(link.code) <= set(INVITE_ALPHABET))
        self.assertFalse(set(link.code) & set("0Oo1lI"))
        invite = self.client.get(f"/api/events/{self.event_id}/invite").data
        self.assertEqual(invite["url"], f"https://globeville.app/e/{link.code}")
        # Ana's account is in Spanish.
        self.assertTrue(invite["message"].startswith("¡Ven a Block party el "))
        self.assertTrue(invite["message"].endswith(f"Confirma aquí: {invite['url']}"))

    def test_only_hosts_get_or_reset_the_link(self):
        self.as_user(self.ben)
        self.assertEqual(self.client.get(f"/api/events/{self.event_id}/invite").status_code, 403)
        self.assertEqual(self.client.post(f"/api/events/{self.event_id}/invite/reset").status_code, 403)

    def test_resetting_retires_the_old_code_but_not_access_already_given(self):
        old = self.client.get(f"/api/events/{self.event_id}/invite").data["code"]
        self.as_user(self.cy)  # another neighborhood
        self.assertEqual(self.client.get(f"/api/invites/{old}").status_code, 200)
        self.as_user(self.ana)
        new = self.client.post(f"/api/events/{self.event_id}/invite/reset").data["code"]
        self.assertNotEqual(old, new)
        self.as_user(self.ben)
        response = self.client.get(f"/api/invites/{old}")
        self.assertEqual((response.status_code, response.data["code"]), (410, "invite_revoked"))
        self.assertEqual(self.client.get(f"/api/invites/{new}").status_code, 200)
        self.as_user(self.cy)
        self.assertEqual(self.client.get(f"/api/events/{self.event_id}").status_code, 200)  # still has access

    def test_unknown_code(self):
        self.assertEqual(self.client.get("/api/invites/nope").data, {"code": "invite_not_found"})

    def test_old_events_got_a_link_from_the_migration(self):
        import importlib

        from django.apps import apps

        event = self.make_event(self.ben)
        InviteLink.objects.filter(event=event).delete()
        importlib.import_module("events.migrations.0005_invite_links").give_every_event_a_link(apps, None)
        self.assertTrue(InviteLink.objects.filter(event=event).exists())


class AccessTests(EventTestCase):
    """A link lets members from any neighborhood use the event like a neighbor (Changes Milestone 2)."""

    def setUp(self):
        super().setUp()
        self.event = self.make_event(self.ana, latitude=39.76, longitude=-105.01)
        self.code = InviteLink.current(self.event).code
        self.as_user(self.cy)

    def test_without_the_link_other_neighborhoods_still_get_404(self):
        self.assertEqual(self.client.get(f"/api/events/{self.event.pk}").status_code, 404)
        self.assertEqual(self.client.put(f"/api/events/{self.event.pk}/going").status_code, 404)

    def test_opening_the_link_lets_them_see_it_and_go(self):
        detail = self.client.get(f"/api/invites/{self.code}").data
        self.assertEqual(detail["id"], self.event.pk)
        self.assertTrue(EventAccess.objects.filter(user=self.cy, event=self.event).exists())
        self.assertEqual(self.client.get(f"/api/events/{self.event.pk}").status_code, 200)
        self.assertEqual(self.client.put(f"/api/events/{self.event.pk}/going").data["going_count"], 1)
        # Opening it twice is fine.
        self.assertEqual(self.client.get(f"/api/invites/{self.code}").status_code, 200)
        self.assertEqual(EventAccess.objects.count(), 1)
        # It isn't on their own neighborhood's calendar.
        self.assertEqual(self.client.get("/api/events").data["events"], [])

    def test_check_in_and_collect_work_through_the_link(self):
        self.client.get(f"/api/invites/{self.code}")
        self.client.put(f"/api/events/{self.event.pk}/going")
        engine.record_attendance(self.cy, self.event, "auto", now=self.event.starts_at)
        attendance = Attendance.objects.get(user=self.cy)
        self.assertEqual(attendance.neighborhood_id, 3)  # the event's neighborhood
        self.assertTrue(attendance.is_first_in_neighborhood)
        other = self.make_event(
            self.ana, starts_at=timezone.now() - timedelta(hours=5), ends_at=timezone.now() - timedelta(hours=1)
        )
        EventAccess.objects.create(user=self.cy, event=other)
        Going.objects.create(user=self.cy, event=other)
        response = self.client.post(f"/api/events/{other.pk}/collect")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertLess(event_end(other), timezone.now())


class LinkOnlyTests(EventTestCase):
    def setUp(self):
        super().setUp()
        self.as_user(self.ana)
        self.event_id = self.post_event(title="Secret supper", visibility="link_only").data["id"]

    def test_never_on_anyone_elses_calendar_or_detail_without_the_link(self):
        self.as_user(self.ben)  # same neighborhood
        self.assertEqual(self.client.get("/api/events").data["events"], [])
        self.assertEqual(self.client.get("/api/events?for_you=true").data["events"], [])
        self.assertEqual(self.client.get(f"/api/events/{self.event_id}").status_code, 404)
        code = InviteLink.objects.get(event_id=self.event_id).code
        self.assertEqual(self.client.get(f"/api/invites/{code}").data["visibility"], "link_only")
        self.assertEqual(self.client.get("/api/events").data["events"], [])  # still not on the calendar

    def test_the_host_still_finds_it(self):
        listed = self.client.get("/api/events").data["events"]
        self.assertEqual([e["id"] for e in listed], [self.event_id])

    def test_visibility_is_checked_and_editable(self):
        self.assertEqual(self.post_event(visibility="secret").data, {"code": "invalid_visibility"})
        response = self.client.patch(f"/api/events/{self.event_id}", {"visibility": "neighborhood"}, format="json")
        self.assertEqual(response.data["visibility"], "neighborhood")
        self.assertEqual(Event.objects.get(pk=self.event_id).visibility, "neighborhood")
