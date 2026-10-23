"""The five value signals and the invite numbers on the owner stats page (GO_LIVE.md §4, MILESTONE_5.md)."""

from datetime import timedelta

from django.utils import timezone

from badges.models import Attendance
from events.models import Going
from guests.models import GuestRSVP, PendingAttendance
from guests.testing import GuestTestCase
from stats.signals import invite_numbers, value_signals
from web.models import DailyCount


class ValueSignalTests(GuestTestCase):
    def test_nothing_yet_means_not_yet_tracked(self):
        from events.models import Event

        Event.objects.all().delete()
        signals = value_signals(None, timezone.now())
        self.assertIsNone(signals["no_partiful_pct"])
        self.assertIsNone(signals["found_pct"])
        self.assertIsNone(signals["conversion"]["pct"])

    def test_the_five_signals_from_fixtures(self):
        now = timezone.now()
        # 1. Two events, one copied from Partiful.
        self.make_event(self.ben, partiful_url="https://partiful.com/e/abc")
        # 2. One found on the calendar, one from an invite link, plus one guest RSVP (invited).
        Going.objects.create(user=self.ben, event=self.event, source="calendar")
        Going.objects.create(user=self.cy, event=self.event, source="invite_link")
        self.rsvp(browser=self.client_class(HTTP_ACCEPT_LANGUAGE="es"))
        # 3. Two active members, one in Spanish (Ana).
        from accounts.models import Account

        Account.objects.filter(user__in=[self.ana, self.ben]).update(last_seen_at=now)
        # 4. Ben's first counted attendance, and another 10 days later.
        first = self.make_event(self.ana, starts_at=now - timedelta(days=20))
        second = self.make_event(self.ana, starts_at=now - timedelta(days=10))
        for event in (first, second):
            Attendance.objects.create(user=self.ben, event=event, neighborhood_id=3, method="collect")
        Attendance.objects.create(user=self.cy, event=second, neighborhood_id=3, method="collect")
        # 5. The guest's event ended and they joined.
        PendingAttendance.objects.create(
            rsvp=GuestRSVP.objects.get(), expires_at=now, claimed_at=now, claimed_by=self.cy
        )

        signals = value_signals(now - timedelta(days=30), now)
        self.assertEqual(signals["no_partiful_pct"], 75)  # 3 of the 4 events were posted here first
        self.assertEqual(signals["found_pct"], 33)  # 1 found of 3
        self.assertEqual(signals["spanish_members_pct"], 50)
        self.assertEqual(signals["spanish_guests_pct"], 100)
        self.assertEqual(signals["came_back_pct"], 50)  # Ben came back, Cy (one visit) not yet
        self.assertEqual(signals["conversion"], {"joined": 1, "of": 1, "pct": 100})

    def test_going_source_defaults_to_unknown_and_is_saved_from_the_app(self):
        self.as_user(self.ben)
        self.client.put(f"/api/events/{self.event.pk}/going", {"source": "for_you"}, format="json")
        self.assertEqual(Going.objects.get(user=self.ben).source, "for_you")
        self.as_user(self.ana)
        other = self.make_event(self.ben)
        self.client.put(f"/api/events/{other.pk}/going", {"source": "nonsense"}, format="json")
        self.assertEqual(Going.objects.get(user=self.ana).source, "unknown")


class InviteNumberTests(GuestTestCase):
    def test_counts_conversion_and_budget(self):
        self.as_user(self.ana)
        self.client.post(f"/api/events/{self.event.pk}/invite/shared")
        self.web.get(f"/e/{self.code}")
        self.rsvp(consent_collect="on")
        numbers = invite_numbers(timezone.now())
        self.assertEqual((numbers["invite_shares"], numbers["web_page_views"]), (1, 1))  # only the page view, not the form steps
        self.assertEqual((numbers["guest_rsvps"], numbers["collect_opt_ins"]), (1, 1))
        self.assertEqual(numbers["texts_by_kind"]["code"], 1)
        self.assertEqual(numbers["spent_usd"], 0.01)
        self.assertEqual(DailyCount.objects.get(key="invite_share").count, 1)

    def test_the_page_shows_them(self):
        from django.contrib.auth import get_user_model

        staff = get_user_model().objects.create_superuser(username="team@example.com", password="x")
        self.client.force_login(staff)
        page = self.client.get("/admin/stats/")
        self.assertContains(page, "Guest-to-member conversion")
        self.assertContains(page, "not yet tracked")
        self.assertContains(page, "invite shares")
