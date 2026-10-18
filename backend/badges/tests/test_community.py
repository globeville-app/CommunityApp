"""Community badges and the owner stats page's Milestone 3 numbers."""

from django.utils import timezone

from badges.community import known_for
from badges.tests.helpers import BadgeTestCase, denver

IN_2025 = denver(2025, 6, 1, 12)  # the helper's events are early 2025
from events.models import Going
from stats.numbers import badge_numbers


class CommunityBadgeTests(BadgeTestCase):
    def test_cleanups_signature_needs_4_events_and_15_neighbors(self):
        people = self.members(15)
        for i in range(4):
            event = self.event(category="cleanup")
            for person in people[i * 4 : i * 4 + 6] if i < 3 else people[12:]:
                self.attend(person, event)
        self.assertEqual(known_for(IN_2025), [("Highland", ["Known for cleanups"])])

    def test_quiet_neighborhoods_have_none(self):
        event = self.event(category="cleanup")
        for person in self.members(3):
            self.attend(person, event)
        self.assertEqual(known_for(IN_2025), [])

    def test_only_the_last_12_months_count(self):
        people = self.members(15)
        for _ in range(4):
            event = self.event(category="cleanup")
            for person in people:
                self.attend(person, event)
        self.assertEqual(len(known_for(IN_2025)), 1)
        self.assertEqual(known_for(denver(2026, 6, 1, 12)), [])


class OwnerBadgeNumberTests(BadgeTestCase):
    def test_counts_methods_declines_and_shares(self):
        event = self.event(category="cleanup")
        self.attend(self.ana, event, method="auto")
        self.attend(self.member("ben"), event, method="collect")
        declined = self.event()
        Going.objects.create(user=self.ana, event=declined)
        self.api(self.ana).post(f"/api/events/{declined.pk}/decline")
        self.api(self.ana).post("/api/badges/local/shared")
        numbers = badge_numbers(timezone.now())
        self.assertEqual((numbers["attended_auto"], numbers["attended_collect"]), (1, 1))
        self.assertEqual(numbers["declines"], 1)
        self.assertEqual(numbers["shares"], 1)
        self.assertGreater(numbers["badges_earned"], 0)
