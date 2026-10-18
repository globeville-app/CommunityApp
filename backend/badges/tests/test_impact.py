"""The host's My Impact numbers (docs/BADGES.md, Impact metric definitions)."""

from badges import engine
from badges.tests.helpers import BadgeTestCase


class ImpactTests(BadgeTestCase):
    def test_empty_until_the_first_counted_hosted_event(self):
        event = self.event()
        self.attend(self.ana, event)  # only one attendee: not counted yet
        self.assertEqual(engine.impact(self.host), {})

    def test_neighbors_brought_together_counts_distinct_people(self):
        regulars = self.members(3)
        for _ in range(5):
            event = self.event()
            for person in regulars:
                self.attend(person, event)
        numbers = engine.impact(self.host)
        self.assertEqual(numbers["brought_together"], 3)  # not 15
        self.assertEqual(numbers["most_popular"]["attendee_count"], 3)

    def test_first_timers_are_scoped_to_the_neighborhood(self):
        # Ana already went to something in Hale; her first Highland event is the host's.
        hale_event = self.event(host=self.member("halehost", self.hale), neighborhood=self.hale)
        self.attend(self.ana, hale_event)
        event = self.event()
        self.attend(self.ana, event)
        veteran = self.member("vet")
        self.attend(veteran, self.event(host=self.member("other")))  # vet's first Highland event elsewhere
        self.attend(veteran, event)
        self.assertEqual(engine.impact(self.host)["first_timers"], 1)  # Ana only

    def test_came_back_counts_a_later_event_from_any_host_in_the_same_neighborhood(self):
        event = self.event()
        back, gone, elsewhere = self.member("back"), self.member("gone"), self.member("elsewhere")
        for person in (back, gone, elsewhere):
            self.attend(person, event)
        self.assertEqual(engine.impact(self.host)["came_back"], 0)
        self.attend(back, self.event(host=self.member("someone")))  # later, other host, same neighborhood
        hale_host = self.member("hh", self.hale)
        self.attend(elsewhere, self.event(host=hale_host, neighborhood=self.hale))  # other neighborhood
        self.assertEqual(engine.impact(self.host)["came_back"], 1)

    def test_deleted_members_drop_out(self):
        event = self.event()
        people = self.members(3)
        for person in people:
            self.attend(person, event)
        people[0].delete()
        numbers = engine.impact(self.host)
        self.assertEqual(numbers["brought_together"], 2)
        self.assertEqual(numbers["first_timers"], 2)

    def test_the_api_returns_it_only_to_the_host(self):
        event = self.event(title="Alley Cleanup")
        for person in self.members(2):
            self.attend(person, event)
        mine = self.api(self.host).get("/api/me/impact").data
        self.assertEqual(mine["brought_together"], 2)
        self.assertEqual(mine["most_popular"]["title"], "Alley Cleanup")
        self.assertEqual(self.api(self.ana).get("/api/me/impact").data, {})
