"""Creating, listing, editing and cancelling events."""

from datetime import datetime, timedelta, timezone as dt_timezone


from django.utils import timezone

from events.models import Event, EventReport, Going
from events.tests.helpers import EventTestCase
from profiles.models import Profile


class CreateEventTests(EventTestCase):
    def test_valid_event_is_created_in_my_neighborhood(self):
        response = self.post_event(neighborhood=1)  # a neighborhood sent by the app is ignored
        self.assertEqual(response.status_code, 201, response.data)
        event = Event.objects.get()
        self.assertEqual(event.neighborhood_id, 3)
        self.assertEqual(event.organizer, self.ana)
        self.assertEqual(event.status, "active")
        self.assertEqual(response.data["group"], "celebrate")
        self.assertEqual(response.data["going_count"], 0)
        self.assertTrue(response.data["is_organizer"])
        self.assertEqual(response.data["organizer_name"], "Ana R.")

    def test_language_defaults_to_the_organizers_language(self):
        self.assertEqual(self.post_event().data["language"], "es")  # Ana chose Spanish
        self.as_user(self.ben)
        self.assertEqual(self.post_event().data["language"], "en")
        self.assertEqual(self.post_event(language="es", title_alt="Comida").data["title_alt"], "Comida")

    def test_first_event_makes_the_member_an_organizer(self):
        self.assertEqual(Profile.objects.get(user=self.ana).role, "member")
        self.post_event()
        self.assertEqual(Profile.objects.get(user=self.ana).role, "organizer")

    def test_rejected_input(self):
        past = (timezone.localtime() - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%S")
        start = self.later(days=3)
        before_start = self.later(days=2)
        cases = [
            ({"starts_at": past}, "start_in_past"),
            ({"starts_at": ""}, "start_required"),
            ({"starts_at": "next tuesday"}, "invalid_start"),
            ({"starts_at": start, "ends_at": before_start}, "end_before_start"),
            ({"starts_at": start, "ends_at": start}, "end_before_start"),
            ({"title": ""}, "title_required"),
            ({"title": "x" * 81}, "title_too_long"),
            ({"description": "x" * 2001}, "description_too_long"),
            ({"title_alt": "x" * 81}, "title_alt_too_long"),
            ({"location_text": ""}, "location_required"),
            ({"location_text": "x" * 121}, "location_too_long"),
            ({"partiful_url": "https://evil.example.com/e/1"}, "invalid_partiful_url"),
            ({"partiful_url": "http://partiful.com/e/1"}, "invalid_partiful_url"),
            ({"partiful_url": "https://partiful.com.evil.com/e/1"}, "invalid_partiful_url"),
            ({"category": "rave"}, "invalid_category"),
            ({"category": "other"}, "other_needs_text"),
            ({"category": "other", "category_other": "x" * 41}, "other_too_long"),
            ({"language": "fr"}, "invalid_language"),
        ]
        for overrides, code in cases:
            with self.subTest(code=code):
                response = self.post_event(**overrides)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.data, {"code": code})
        self.assertFalse(Event.objects.exists())

    def test_limits_are_inclusive(self):
        response = self.post_event(
            title="x" * 80, description="x" * 2000, location_text="x" * 120,
            category="other", category_other="x" * 40,
            partiful_url="https://www.partiful.com/e/abc",
        )
        self.assertEqual(response.status_code, 201, response.data)

    def test_other_text_is_cleared_for_other_categories(self):
        self.post_event(category="potluck", category_other="ignored")
        self.assertEqual(Event.objects.get().category_other, "")

    def test_sponsor_name_cannot_be_set_or_read(self):
        response = self.post_event(sponsor_name="Big Soda")
        self.assertEqual(Event.objects.get().sponsor_name, "")
        self.assertNotIn("sponsor_name", response.data)
        Event.objects.update(sponsor_name="Big Soda")
        event_id = Event.objects.get().pk
        for body in (self.client.get(f"/api/events/{event_id}").content, self.client.get("/api/events").content):
            self.assertNotIn(b"sponsor", body)
            self.assertNotIn(b"Big Soda", body)
        self.client.patch(f"/api/events/{event_id}", {"sponsor_name": "Other"}, format="json")
        self.assertEqual(Event.objects.get().sponsor_name, "Big Soda")

    def test_daily_limit(self):
        codes = [self.post_event().status_code for _ in range(11)]
        self.assertEqual(codes, [201] * 10 + [429])
        self.assertEqual(self.post_event().data, {"code": "daily_limit"})

    def test_needs_a_profile(self):
        from django.contrib.auth import get_user_model
        from rest_framework.authtoken.models import Token

        newbie = get_user_model().objects.create_user(username="new@example.com", password="x")
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {Token.objects.create(user=newbie).key}")
        self.assertEqual(self.post_event().data, {"code": "profile_not_found"})
        self.assertEqual(self.client.get("/api/events").status_code, 404)

    def test_needs_a_login(self):
        self.client.credentials()
        self.assertEqual(self.client.get("/api/events").status_code, 401)


class TimeZoneTests(EventTestCase):
    def test_6pm_denver_is_stored_in_utc_and_returned_as_6pm_denver(self):
        year = timezone.localtime().year + 1
        response = self.post_event(starts_at=f"{year}-10-24T18:00:00")  # Denver is UTC-6 in October
        event = Event.objects.get()
        self.assertEqual(event.starts_at, datetime(year, 10, 25, 0, 0, tzinfo=dt_timezone.utc))
        self.assertEqual(response.data["starts_at"], f"{year}-10-24T18:00:00-06:00")
        # A winter date is UTC-7.
        response = self.post_event(starts_at=f"{year}-01-10T18:00:00")
        self.assertEqual(response.data["starts_at"], f"{year}-01-10T18:00:00-07:00")

    def test_times_with_a_zone_are_respected(self):
        year = timezone.localtime().year + 1
        response = self.post_event(starts_at=f"{year}-10-25T00:00:00Z")
        self.assertEqual(response.data["starts_at"], f"{year}-10-24T18:00:00-06:00")


class ListAndDetailTests(EventTestCase):
    def test_only_my_neighborhoods_upcoming_events_soonest_first(self):
        later = self.make_event(self.ben, title="Later", starts_at=timezone.now() + timedelta(days=5))
        sooner = self.make_event(self.ben, title="Sooner", starts_at=timezone.now() + timedelta(days=1))
        cancelled = self.make_event(self.ben, title="Cancelled", status="cancelled")
        ongoing = self.make_event(
            self.ben, title="Ongoing",
            starts_at=timezone.now() - timedelta(hours=1), ends_at=timezone.now() + timedelta(hours=1),
        )
        self.make_event(self.ben, title="Past", starts_at=timezone.now() - timedelta(days=1))
        self.make_event(self.cy, neighborhood_id=1, title="Elsewhere")

        titles = [e["title"] for e in self.client.get("/api/events").data["events"]]
        self.assertEqual(titles, ["Ongoing", "Sooner", "Cancelled", "Later"])
        statuses = {e["title"]: e["status"] for e in self.client.get("/api/events").data["events"]}
        self.assertEqual(statuses["Cancelled"], "cancelled")
        del later, sooner, cancelled, ongoing

    def test_group_filter(self):
        self.make_event(self.ben, title="Potluck", category="potluck")
        self.make_event(self.ben, title="Cleanup", category="cleanup")
        self.make_event(self.ben, title="Mystery", category="other", category_other="Séance")
        titles = lambda g: [e["title"] for e in self.client.get(f"/api/events?group={g}").data["events"]]
        self.assertEqual(titles("celebrate"), ["Potluck"])
        self.assertEqual(titles("community"), ["Cleanup"])
        self.assertEqual(self.client.get("/api/events?group=nope").data, {"code": "invalid_group"})

    def test_detail(self):
        event = self.make_event(self.ben, description="Bring chairs")
        data = self.client.get(f"/api/events/{event.pk}").data
        self.assertEqual(data["description"], "Bring chairs")
        self.assertEqual(data["organizer_name"], "Ben R.")
        self.assertFalse(data["is_organizer"])
        self.assertFalse(data["is_going"])

    def test_other_neighborhoods_get_404_everywhere(self):
        event = self.make_event(self.ben)
        self.as_user(self.cy)
        self.assertEqual(self.client.get("/api/events").data["events"], [])
        endpoints = [
            ("get", f"/api/events/{event.pk}", {}),
            ("patch", f"/api/events/{event.pk}", {"title": "Mine now"}),
            ("post", f"/api/events/{event.pk}/cancel", {}),
            ("put", f"/api/events/{event.pk}/going", {}),
            ("delete", f"/api/events/{event.pk}/going", {}),
            ("post", f"/api/events/{event.pk}/report", {"reason": "spam"}),
            ("post", f"/api/events/{event.pk}/translate", {"target": "es"}),
        ]
        for method, url, body in endpoints:
            with self.subTest(method=method, url=url):
                response = getattr(self.client, method)(url, body, format="json")
                self.assertEqual(response.status_code, 404)
                self.assertEqual(response.data, {"code": "event_not_found"})
        self.assertFalse(Going.objects.exists())
        self.assertFalse(EventReport.objects.exists())

    def test_names_are_display_names_and_going_is_a_count(self):
        event = self.make_event(self.ben)
        Going.objects.create(event=event, user=self.ben)
        body = self.client.get(f"/api/events/{event.pk}").content.decode()
        self.assertIn("Ben R.", body)
        self.assertNotIn("ben@example.com", body)
        self.assertNotIn('"Ben"', body)


class EditAndCancelTests(EventTestCase):
    def setUp(self):
        super().setUp()
        self.event_id = self.post_event().data["id"]

    def test_organizer_can_edit_including_the_category(self):
        response = self.client.patch(
            f"/api/events/{self.event_id}", {"title": "Winter potluck", "category": "festival"}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["title"], "Winter potluck")
        self.assertEqual(response.data["group"], "celebrate")
        self.assertEqual(response.data["description"], "Bring a dish to share.")  # unchanged

    def test_only_the_organizer_can_edit_or_cancel(self):
        self.as_user(self.ben)
        edit = self.client.patch(f"/api/events/{self.event_id}", {"title": "Hijacked"}, format="json")
        cancel = self.client.post(f"/api/events/{self.event_id}/cancel")
        self.assertEqual((edit.status_code, edit.data), (403, {"code": "not_organizer"}))
        self.assertEqual((cancel.status_code, cancel.data), (403, {"code": "not_organizer"}))
        self.assertEqual(Event.objects.get().title, "Fall potluck")
        self.assertEqual(Event.objects.get().status, "active")

    def test_cancel_keeps_the_event_and_going_records(self):
        self.as_user(self.ben)
        self.client.put(f"/api/events/{self.event_id}/going")
        self.as_user(self.ana)
        response = self.client.post(f"/api/events/{self.event_id}/cancel")
        self.assertEqual(response.data["status"], "cancelled")
        self.assertEqual(response.data["going_count"], 1)
        self.assertTrue(Event.objects.filter(pk=self.event_id).exists())
        self.assertEqual(Going.objects.count(), 1)
        edit = self.client.patch(f"/api/events/{self.event_id}", {"title": "Back on"}, format="json")
        self.assertEqual(edit.data, {"code": "event_cancelled"})

    def test_a_started_event_cant_be_moved(self):
        Event.objects.filter(pk=self.event_id).update(starts_at=timezone.now() - timedelta(minutes=5))
        moved = self.client.patch(f"/api/events/{self.event_id}", {"starts_at": self.later(days=1)}, format="json")
        self.assertEqual(moved.data, {"code": "event_started"})
        # Other details can still be fixed.
        fixed = self.client.patch(f"/api/events/{self.event_id}", {"location_text": "The gym"}, format="json")
        self.assertEqual(fixed.status_code, 200, fixed.data)

    def test_edit_checks_the_same_rules(self):
        response = self.client.patch(f"/api/events/{self.event_id}", {"category": "other"}, format="json")
        self.assertEqual(response.data, {"code": "other_needs_text"})


class GoingTests(EventTestCase):
    def setUp(self):
        super().setUp()
        self.event = self.make_event(self.ben)
        self.url = f"/api/events/{self.event.pk}/going"

    def test_mark_unmark_and_count(self):
        self.assertEqual(self.client.put(self.url).data, {"going_count": 1, "is_going": True})
        self.assertEqual(self.client.put(self.url).data, {"going_count": 1, "is_going": True})  # once per member
        self.as_user(self.ben)
        self.assertEqual(self.client.put(self.url).data, {"going_count": 2, "is_going": True})
        self.assertEqual(self.client.delete(self.url).data, {"going_count": 1, "is_going": False})
        self.as_user(self.ana)
        detail = self.client.get(f"/api/events/{self.event.pk}").data
        self.assertEqual((detail["going_count"], detail["is_going"]), (1, True))
        listed = self.client.get("/api/events").data["events"][0]
        self.assertEqual((listed["going_count"], listed["is_going"]), (1, True))

    def test_rejected_on_cancelled_or_past_events(self):
        Event.objects.filter(pk=self.event.pk).update(status="cancelled")
        self.assertEqual(self.client.put(self.url).data, {"code": "event_cancelled"})
        Event.objects.filter(pk=self.event.pk).update(status="active", starts_at=timezone.now() - timedelta(days=1))
        self.assertEqual(self.client.put(self.url).data, {"code": "event_past"})
        self.assertFalse(Going.objects.exists())


class ReportTests(EventTestCase):
    def test_any_member_can_report_and_it_lands_in_admin(self):
        event = self.make_event(self.ben)
        response = self.client.post(f"/api/events/{event.pk}/report", {"reason": "Looks like spam"}, format="json")
        self.assertEqual(response.status_code, 201)
        report = EventReport.objects.get()
        self.assertEqual((report.event, report.reporter, report.reason), (event, self.ana, "Looks like spam"))
        empty = self.client.post(f"/api/events/{event.pk}/report", {"reason": " "}, format="json")
        self.assertEqual(empty.data, {"code": "reason_required"})

        from django.contrib.auth import get_user_model

        staff = get_user_model().objects.create_superuser(username="staff@example.com", password="x")
        self.client.force_login(staff)
        page = self.client.get("/admin/events/eventreport/")
        self.assertContains(page, "Looks like spam")


class DeletedOrganizerTests(EventTestCase):
    def test_deleting_an_account_cancels_upcoming_events_and_hides_the_name(self):
        upcoming = self.make_event(self.ben, title="Upcoming")
        past = self.make_event(self.ben, title="Past", starts_at=timezone.now() - timedelta(days=3))
        mine = self.make_event(self.ana, title="Ana's")
        Going.objects.create(event=mine, user=self.ben)
        Going.objects.create(event=past, user=self.ana)

        self.as_user(self.ben)
        response = self.client.post("/api/account/delete", {"password": "a long pass phrase"}, format="json")
        self.assertEqual(response.status_code, 204)

        upcoming.refresh_from_db()
        past.refresh_from_db()
        self.assertEqual(upcoming.status, "cancelled")
        self.assertEqual(past.status, "active")
        self.assertIsNone(past.organizer)
        # Ben's "I'm going" is gone; Ana's stays.
        self.assertEqual(list(Going.objects.values_list("event__title", flat=True)), ["Past"])

        self.as_user(self.ana)
        detail = self.client.get(f"/api/events/{upcoming.pk}").data
        self.assertIsNone(detail["organizer_name"])  # the app shows "Former neighbor"
        self.assertFalse(detail["is_organizer"])
