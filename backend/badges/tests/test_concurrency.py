"""
Many members collecting at the same moment (found by the automated review).
Needs Postgres, which has row locks; SQLite in development doesn't, so this
is skipped there. Run with DATABASE_URL pointing at a Postgres database.
"""

import threading
import unittest
from datetime import timedelta

from django.db import connection, connections
from django.test import TransactionTestCase

from badges import engine
from badges.models import BadgeState, Celebration
from badges.tests.helpers import BadgeTestCase
from events.models import Going


@unittest.skipUnless(connection.vendor == "postgresql", "needs Postgres row locks")
class SimultaneousCollectTests(TransactionTestCase):
    setUp = BadgeTestCase.setUp
    member = BadgeTestCase.member
    members = BadgeTestCase.members
    event = BadgeTestCase.event

    def test_the_hosts_count_and_celebrations_stay_right(self):
        from badges.tests.helpers import denver

        events = [self.event(starts=denver(2025, 3, 1, 9 + 2 * i)) for i in range(4)]
        people = self.members(12)
        for i, person in enumerate(people):
            Going.objects.create(user=person, event=events[i % 4])
        start = threading.Barrier(len(people))
        errors = []

        def collect(person, event):
            try:
                start.wait()
                engine.record_attendance(person, event, "collect", now=events[-1].starts_at + timedelta(days=1))
            except Exception as error:  # noqa: BLE001 (report anything)
                errors.append(repr(error))
            finally:
                connections.close_all()

        threads = [threading.Thread(target=collect, args=(p, events[i % 4])) for i, p in enumerate(people)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        self.assertEqual(errors, [])
        host = BadgeState.objects.get(user=self.host, badge_key="host")
        self.assertEqual(host.count, 12)  # every neighbor counted once
        self.assertEqual(host.stage, 2)  # 12 reaches Sprout (10)
        kinds = list(Celebration.objects.filter(user=self.host, badge_key="host").values_list("kind", "stage"))
        self.assertEqual(sorted(kinds), [("earned", 1), ("stage_up", 2)])  # no duplicates
