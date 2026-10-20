"""Milestone 3 changes to events: map pins, the midnight rule, and locks."""

from datetime import datetime, timedelta
from unittest import mock

from django.utils import timezone

from accounts.models import DeviceToken
from events.models import Event
from events.tests.helpers import EventTestCase
from events.timing import event_end


class PinTests(EventTestCase):
    def test_new_events_need_a_pin_in_denver(self):
        cases = [
            ({"latitude": None}, "pin_required"),
            ({"longitude": ""}, "pin_required"),
            ({"latitude": "north"}, "invalid_pin"),
            ({"latitude": 40.7128, "longitude": -74.0060}, "pin_outside_denver"),  # New York
        ]
        for overrides, code in cases:
            with self.subTest(code=code):
                self.assertEqual(self.post_event(**overrides).data, {"code": code})
        response = self.post_event(latitude=39.761512345, longitude=-105.0112)
        self.assertEqual((response.data["latitude"], response.data["longitude"]), (39.761512, -105.0112))

    def test_editing_an_old_pinless_event_asks_for_a_pin(self):
        old = self.make_event(self.ana)  # posted before pins existed
        detail = self.client.get(f"/api/events/{old.pk}").data
        self.assertIsNone(detail["latitude"])
        self.assertTrue(detail["needs_pin"])
        edit = self.client.patch(f"/api/events/{old.pk}", {"title": "Renamed"}, format="json")
        self.assertEqual(edit.data, {"code": "pin_required"})
        fixed = self.client.patch(f"/api/events/{old.pk}", {"latitude": 39.76, "longitude": -105.01}, format="json")
        self.assertEqual(fixed.status_code, 200)
        self.assertFalse(fixed.data["needs_pin"])
        # Neighbors never see the prompt.
        self.as_user(self.ben)
        self.assertFalse(self.client.get(f"/api/events/{self.make_event(self.ana).pk}").data["needs_pin"])

    def test_the_pin_is_locked_once_the_event_starts(self):
        event_id = self.post_event().data["id"]
        Event.objects.filter(pk=event_id).update(starts_at=timezone.now() - timedelta(minutes=5))
        moved = self.client.patch(f"/api/events/{event_id}", {"latitude": 39.70, "longitude": -105.0}, format="json")
        self.assertEqual(moved.data, {"code": "event_started"})
        same = self.client.patch(f"/api/events/{event_id}", {"title": "Still on"}, format="json")
        self.assertEqual(same.status_code, 200)


class CategoryLockTests(EventTestCase):
    def test_category_cant_change_after_the_event_ends(self):
        event = self.make_event(
            self.ana, latitude=39.76, longitude=-105.01,
            starts_at=timezone.now() - timedelta(hours=3), ends_at=timezone.now() - timedelta(hours=1),
        )
        changed = self.client.patch(f"/api/events/{event.pk}", {"category": "festival"}, format="json")
        self.assertEqual(changed.data, {"code": "category_locked"})
        kept = self.client.patch(f"/api/events/{event.pk}", {"description": "Thanks all!"}, format="json")
        self.assertEqual(kept.status_code, 200)


class MidnightRuleTests(EventTestCase):
    def denver(self, *args):
        return timezone.make_aware(datetime(*args), timezone.get_current_timezone())

    def test_no_end_time_means_midnight_denver_time(self):
        event = Event(starts_at=self.denver(2026, 10, 31, 19, 0))
        self.assertEqual(event_end(event), self.denver(2026, 11, 1, 0, 0))
        event = Event(starts_at=self.denver(2026, 10, 31, 19), ends_at=self.denver(2026, 10, 31, 22))
        self.assertEqual(event_end(event), self.denver(2026, 10, 31, 22))

    def test_an_open_ended_event_stays_listed_and_joinable_until_midnight(self):
        evening = self.denver(2030, 6, 1, 18, 0)
        event = self.make_event(self.ben, starts_at=evening)
        # Logins unused for 90 days expire; keep this one fresh in 2030.
        DeviceToken.objects.update(last_used_at=evening)
        with mock.patch("django.utils.timezone.now", return_value=self.denver(2030, 6, 1, 23, 30)):
            titles = [e["title"] for e in self.client.get("/api/events").data["events"]]
            self.assertIn(event.title, titles)
            self.assertEqual(self.client.put(f"/api/events/{event.pk}/going").status_code, 200)
        with mock.patch("django.utils.timezone.now", return_value=self.denver(2030, 6, 2, 0, 1)):
            self.assertEqual(self.client.get("/api/events").data["events"], [])
            self.assertEqual(self.client.put(f"/api/events/{event.pk}/going").data, {"code": "event_past"})
