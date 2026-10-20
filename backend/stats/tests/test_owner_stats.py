"""The owner stats page (docs/GO_LIVE.md §4): staff only, counts only."""

from datetime import timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from accounts.models import DeviceToken
from rest_framework.test import APIClient

from accounts.models import Account
from events.models import Event, Going
from neighborhoods.models import Neighborhood, NeighborhoodMatch
from profiles.models import Profile
from stats.numbers import all_numbers
from support.models import ProblemReport

User = get_user_model()


class Fixtures(TestCase):
    def setUp(self):
        self.now = timezone.now()
        self.highland = Neighborhood.objects.create(id=3, name="Highland", source_version="t")
        self.hale = Neighborhood.objects.create(id=1, name="Hale", source_version="t")

    def member(self, email, joined_days_ago=0, seen_days_ago=None, language="en", neighborhood=None, first="Zara"):
        user = User.objects.create_user(username=email, email=email, password="x")
        User.objects.filter(pk=user.pk).update(date_joined=self.now - timedelta(days=joined_days_ago))
        seen = self.now - timedelta(days=seen_days_ago) if seen_days_ago is not None else None
        Account.objects.create(user=user, language=language, last_seen_at=seen)
        if neighborhood:
            NeighborhoodMatch.objects.create(user=user, neighborhood=neighborhood)
            Profile.objects.create(user=user, first_name=first, last_initial="Q", neighborhood=neighborhood)
        return user

    def event(self, organizer, category="potluck", created_days_ago=0, starts_in_days=2, **extra):
        event = Event.objects.create(
            neighborhood=self.highland, organizer=organizer, category=category, title="T",
            location_text="Somewhere", starts_at=self.now + timedelta(days=starts_in_days), **extra,
        )
        Event.objects.filter(pk=event.pk).update(created_at=self.now - timedelta(days=created_days_ago))
        return event


class NumbersTests(Fixtures):
    def test_counts_match_the_fixtures(self):
        ana = self.member("ana@example.com", 0, 0, "es", self.highland)
        ben = self.member("ben@example.com", 5, 3, "en", self.highland)
        cy = self.member("cy@example.com", 20, 20, "es", self.hale)
        self.member("old@example.com", 90, 60)
        User.objects.create_superuser(username="boss@example.com", password="x")  # staff never counted

        e1 = self.event(ana, "potluck", created_days_ago=1)
        self.event(ana, "cleanup", created_days_ago=10)
        self.event(ben, "cleanup", created_days_ago=40, starts_in_days=-30)  # old and past
        self.event(cy, "game_night", created_days_ago=2, status="cancelled")
        g = Going.objects.create(event=e1, user=ben)
        Going.objects.filter(pk=g.pk).update(created_at=self.now - timedelta(days=1))
        ProblemReport.objects.create(message="a")
        ProblemReport.objects.create(message="b", status="in_progress")
        ProblemReport.objects.create(message="c", status="resolved")

        n = all_numbers(self.now)
        m = n["members"]
        self.assertEqual((m["total"], m["new_today"], m["new_7"], m["new_30"]), (4, 1, 2, 3))
        self.assertEqual((m["active_7"], m["active_30"]), (2, 3))
        self.assertEqual(m["by_neighborhood"], [("Highland", 2), ("Hale", 1)])
        self.assertEqual(m["by_language"], [("English", 2), ("Español", 2)])
        self.assertEqual(len(m["daily_signups"]), 30)
        self.assertEqual(sum(count for _, count, _ in m["daily_signups"]), 3)

        e = n["events"]
        self.assertEqual((e["posted_7"], e["posted_30"], e["upcoming"]), (2, 3, 2))
        self.assertEqual(dict(e["by_group"])["celebrate"], 1)
        self.assertEqual(dict(e["by_group"])["community"], 1)
        self.assertEqual(dict(e["by_group"])["entertainment"], 1)
        self.assertEqual((e["going_taps_7"], e["organizers"]), (1, 3))
        self.assertEqual(n["support"]["open_reports"], 2)


class PageTests(Fixtures):
    def test_staff_only(self):
        url = reverse("owner-stats")
        self.assertEqual(self.client.get(url).status_code, 302)  # to the admin login
        self.client.force_login(User.objects.create_user(username="m@example.com", password="x"))
        self.assertEqual(self.client.get(url).status_code, 302)
        self.client.force_login(User.objects.create_superuser(username="s@example.com", password="x"))
        self.assertEqual(self.client.get(url).status_code, 200)

    def test_page_shows_no_names_emails_or_photos(self):
        ana = self.member("ana.private@example.com", 0, 0, "es", self.highland, first="Anastasia")
        Profile.objects.filter(user=ana).update(photo="profile_photos/secret.jpg")
        self.event(ana)
        # The admin header greets the signed-in staff member; give them a plain login name.
        self.client.force_login(User.objects.create_superuser(username="staffer", password="x"))
        html = self.client.get(reverse("owner-stats")).content.decode()
        self.assertIn("Highland", html)
        for private in ("Anastasia", "ana.private", "@example.com", "secret.jpg", "profile_photos"):
            self.assertNotIn(private, html)

    def test_admin_home_links_to_it(self):
        self.client.force_login(User.objects.create_superuser(username="s@example.com", password="x"))
        self.assertContains(self.client.get(reverse("admin:index")), reverse("owner-stats"))


class LastSeenTests(Fixtures):
    def test_updates_on_a_signed_in_request_at_most_hourly(self):
        user = self.member("ana@example.com", neighborhood=self.highland)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Token {DeviceToken.issue(user)}")

        client.get("/api/profile/me")
        first = Account.objects.get(user=user).last_seen_at
        self.assertIsNotNone(first)

        later = first + timedelta(minutes=30)
        with mock.patch("django.utils.timezone.now", return_value=later):
            client.get("/api/profile/me")
        self.assertEqual(Account.objects.get(user=user).last_seen_at, first)  # not again within the hour

        much_later = first + timedelta(minutes=61)
        with mock.patch("django.utils.timezone.now", return_value=much_later):
            client.get("/api/profile/me")
        self.assertEqual(Account.objects.get(user=user).last_seen_at, much_later)

    def test_signed_out_requests_change_nothing(self):
        self.client.get("/api/config")
        self.assertFalse(Account.objects.exclude(last_seen_at=None).exists())
