"""Events matching a member's interests: matches_interests and for_you=true."""

from events.tests.helpers import EventTestCase
from profiles.models import Profile


class ForYouTests(EventTestCase):
    def setUp(self):
        super().setUp()
        Profile.objects.filter(user=self.ana).update(interests=["potluck", "cleanup"])
        self.make_event(self.ben, title="Potluck", category="potluck")
        self.make_event(self.ben, title="Cleanup", category="cleanup")
        self.make_event(self.ben, title="Trivia", category="game_night")

    def test_matches_interests_flag(self):
        events = self.client.get("/api/events").data["events"]
        self.assertEqual({e["title"]: e["matches_interests"] for e in events},
                         {"Potluck": True, "Cleanup": True, "Trivia": False})

    def test_for_you_filter(self):
        titles = [e["title"] for e in self.client.get("/api/events?for_you=true").data["events"]]
        self.assertEqual(titles, ["Potluck", "Cleanup"])
        # Combined with a group.
        titles = [e["title"] for e in self.client.get("/api/events?for_you=true&group=community").data["events"]]
        self.assertEqual(titles, ["Cleanup"])

    def test_no_interests_means_nothing_for_you(self):
        self.as_user(self.ben)
        self.assertEqual(self.client.get("/api/events?for_you=true").data["events"], [])
