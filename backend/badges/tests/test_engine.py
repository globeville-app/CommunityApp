"""record_attendance and every badge rule (docs/BADGES.md)."""

from datetime import timedelta
from unittest import mock

from badges import config, engine
from badges.models import Attendance, BadgeState, Celebration
from badges.tests.helpers import BadgeTestCase, denver
from config.errors import ApiError
from events.models import Event, Going
from events.timing import event_end


class RecordAttendanceTests(BadgeTestCase):
    def test_records_a_valid_attendance(self):
        event = self.event()
        celebrations = self.attend(self.ana, event)
        attendance = Attendance.objects.get()
        self.assertEqual((attendance.user, attendance.event, attendance.method), (self.ana, event, "collect"))
        self.assertTrue(attendance.is_first_in_neighborhood)
        self.assertEqual(attendance.neighborhood, self.highland)
        self.assertEqual(attendance.user_language_at_time, "en")
        self.assertIn(("local", "earned"), [(c.badge_key, c.kind) for c in celebrations])

    def code_of(self, call):
        with self.assertRaises(ApiError) as caught:
            call()
        return caught.exception.get_codes()

    def test_rejections(self):
        event = self.event()
        end = event_end(event)
        later = end + timedelta(minutes=5)
        self.assertEqual(self.code_of(lambda: engine.record_attendance(self.ana, event, "collect", now=later)), "not_going")
        Going.objects.create(user=self.host, event=event)
        self.assertEqual(self.code_of(lambda: engine.record_attendance(self.host, event, "collect", now=later)), "is_host")
        Going.objects.create(user=self.ana, event=event)
        self.assertEqual(self.code_of(lambda: engine.record_attendance(self.ana, event, "collect", now=end - timedelta(minutes=1))), "event_not_ended")
        self.assertEqual(self.code_of(lambda: engine.record_attendance(self.ana, event, "collect", now=end + timedelta(days=7, minutes=1))), "collect_window_closed")
        self.assertEqual(self.code_of(lambda: engine.record_attendance(self.ana, event, "auto", now=event.starts_at - timedelta(minutes=31))), "checkin_window_closed")
        self.assertEqual(self.code_of(lambda: engine.record_attendance(self.ana, event, "auto", now=end + timedelta(minutes=1))), "checkin_window_closed")
        Event.objects.filter(pk=event.pk).update(status="cancelled")
        event.refresh_from_db()
        self.assertEqual(self.code_of(lambda: engine.record_attendance(self.ana, event, "collect", now=later)), "event_cancelled")
        self.assertFalse(Attendance.objects.exists())

    def test_windows_are_inclusive(self):
        event = self.event()
        Going.objects.create(user=self.ana, event=event)
        engine.record_attendance(self.ana, event, "auto", now=event.starts_at - timedelta(minutes=30))
        other = self.event()
        Going.objects.create(user=self.ana, event=other)
        engine.record_attendance(self.ana, other, "collect", now=event_end(other) + timedelta(days=7))
        self.assertEqual(Attendance.objects.count(), 2)

    def test_twice_changes_nothing(self):
        event = self.event()
        self.attend(self.ana, event)
        before = list(BadgeState.objects.values_list("badge_key", "count", "stage"))
        self.assertEqual(self.code_of(lambda: self.attend(self.ana, event)), "already_recorded")
        self.assertEqual(Attendance.objects.count(), 1)
        self.assertEqual(list(BadgeState.objects.values_list("badge_key", "count", "stage")), before)
        self.assertEqual(Celebration.objects.filter(user=self.ana, badge_key="local").count(), 1)

    def test_auto_checkin_needs_a_pin_but_collect_does_not(self):
        event = self.event(latitude=None, longitude=None)
        Going.objects.create(user=self.ana, event=event)
        self.assertEqual(self.code_of(lambda: engine.record_attendance(self.ana, event, "auto", now=event.starts_at)), "pin_required")
        engine.record_attendance(self.ana, event, "collect", now=event_end(event) + timedelta(minutes=1))

    def test_no_end_time_ends_at_midnight(self):
        event = self.event(starts=denver(2025, 10, 31, 19))
        Event.objects.filter(pk=event.pk).update(ends_at=None)
        event.refresh_from_db()
        Going.objects.create(user=self.ana, event=event)
        self.assertEqual(self.code_of(lambda: engine.record_attendance(self.ana, event, "collect", now=denver(2025, 10, 31, 23, 59))), "event_not_ended")
        engine.record_attendance(self.ana, event, "collect", now=denver(2025, 11, 1, 0, 0))


class StageThresholdTests(BadgeTestCase):
    def grow(self, key, category, thresholds, host=None):
        """Attend events of `category` one at a time, checking the stage after each."""
        for n in range(1, thresholds[-1] + 1):
            self.attend(self.ana, self.event(host=host, category=category))
            stage, count = self.state(self.ana, key)
            self.assertEqual(count, n, key)
            self.assertEqual(stage, sum(1 for t in thresholds if n >= t), f"{key} at {n}")

    def test_local_follows_the_everyday_track(self):
        self.grow("local", "potluck", config.TRACK_THRESHOLDS["everyday"])
        self.assertEqual(self.state(self.ana, "local")[0], 5)

    def test_every_group_and_signature_badge_follows_the_occasional_track(self):
        cases = [
            ("fiestero", "festival"),
            ("treasure_hunter", "market"),
            ("aficionado", "comedy"),
            ("recreationist", "fitness"),
            ("helping_hand", "volunteering"),
            ("clean_sweeper", "cleanup"),
            ("civic_voice", "community_meeting"),
        ]
        for key, category in cases:
            with self.subTest(badge=key):
                self.ana = self.member(f"a-{key}")
                self.grow(key, category, config.TRACK_THRESHOLDS["occasional"])

    def test_best_guest_counts_distinct_hosts(self):
        thresholds = config.TRACK_THRESHOLDS["variety"]
        hosts = self.members(thresholds[-1], "h")
        for n, host in enumerate(hosts, 1):
            self.attend(self.ana, self.event(host=host))
            self.attend(self.ana, self.event(host=host))  # the same host again adds nothing
            self.assertEqual(self.state(self.ana, "best_guest"), (sum(1 for t in thresholds if n >= t), n))

    def test_one_event_grows_several_badges(self):
        self.attend(self.ana, self.event(category="cleanup"))
        for key in ("local", "helping_hand", "clean_sweeper", "best_guest"):
            self.assertEqual(self.state(self.ana, key)[1], 1, key)
        self.assertEqual(self.state(self.ana, "clean_sweeper")[0], 1)
        self.assertEqual(self.state(self.ana, "fiestero"), (0, 0))

    def test_learn_and_connect_and_other_grow_only_the_general_badges(self):
        self.attend(self.ana, self.event(category="workshop"))
        self.attend(self.ana, self.event(category="other", category_other="Quilting"))
        grown = set(BadgeState.objects.filter(user=self.ana, count__gt=0).values_list("badge_key", flat=True))
        self.assertEqual(grown, {"local", "best_guest"})

    def test_thresholds_come_from_config(self):
        with mock.patch.dict(config.TRACK_THRESHOLDS, {"everyday": [2, 4, 6, 8, 10]}):
            self.attend(self.ana, self.event())
            self.assertEqual(self.state(self.ana, "local"), (0, 1))
            self.attend(self.ana, self.event())
            self.assertEqual(self.state(self.ana, "local"), (1, 2))


class SensitiveCategoryTests(BadgeTestCase):
    def test_attending_grows_nothing_hosting_grows_helping_hand(self):
        for category in ("resource_fair", "donation_drive"):
            event = self.event(category=category)
            friend = self.member(f"f-{category}")
            self.attend(self.ana, event)
            self.attend(friend, event)
        self.assertFalse(BadgeState.objects.filter(user=self.ana, count__gt=0).exists())
        self.assertEqual(self.keepsakes(self.ana), set())
        # The host hosted two counted events: Helping Hand grows.
        self.assertEqual(self.state(self.host, "helping_hand"), (2, 2))


class HostingTests(BadgeTestCase):
    def test_an_event_counts_as_hosted_only_with_two_attendees(self):
        event = self.event(category="cleanup")
        self.attend(self.ana, event)
        event.refresh_from_db()
        self.assertIsNone(event.counted_hosted_at)
        self.assertEqual(self.state(self.host, "clean_sweeper"), (0, 0))
        self.attend(self.member("ben"), event)
        event.refresh_from_db()
        self.assertIsNotNone(event.counted_hosted_at)
        self.assertEqual(self.state(self.host, "clean_sweeper"), (1, 1))  # credited when it crossed
        self.assertEqual(self.state(self.host, "host"), (1, 2))  # Host reach: 2 neighbors = Seed
        self.assertEqual(self.state(self.host, "local"), (0, 0))  # hosting isn't attending

    def test_host_reach_counts_distinct_neighbors(self):
        regulars = self.members(3)
        for _ in range(4):
            event = self.event()
            for person in regulars:
                self.attend(person, event)
        self.assertEqual(self.state(self.host, "host")[1], 3)  # not 12

    def test_day_one_goes_to_everyone_at_the_hosts_first_counted_event(self):
        first = self.event()
        early = self.member("early")
        self.attend(early, first)  # collected before it counted
        self.assertEqual(self.state(early, "day_one"), (0, 0))
        self.attend(self.ana, first)  # the 2nd attendee: now it counts
        self.assertEqual(self.state(early, "day_one"), (1, 1))
        self.assertEqual(self.state(self.ana, "day_one"), (1, 1))
        late = self.member("late")
        self.attend(late, first)
        self.assertEqual(self.state(late, "day_one"), (1, 1))
        # The host's second event isn't a "first".
        second = self.event()
        self.attend(self.member("x"), second)
        self.attend(self.member("y"), second)
        self.assertEqual(self.state(self.member("z"), "day_one"), (0, 0))
        second.refresh_from_db()
        self.assertFalse(second.is_hosts_first_counted)

    def test_open_door_needs_an_organizer_written_second_language(self):
        plain = self.event()
        for person in self.members(2, "p"):
            self.attend(person, plain)
        self.assertNotIn("open_door", self.keepsakes(self.host))
        bilingual = self.event(title_alt="Comida compartida")
        for person in self.members(2, "q"):
            self.attend(person, bilingual)
        self.assertIn("open_door", self.keepsakes(self.host))


class KeepsakeTests(BadgeTestCase):
    def test_ambassador_uses_the_language_at_the_time(self):
        from accounts.models import Account

        self.attend(self.ana, self.event(language="en"))
        self.assertNotIn("ambassador", self.keepsakes(self.ana))
        Account.objects.filter(user=self.ana).update(language="es")
        self.attend(self.ana, self.event(language="en"))
        self.assertIn("ambassador", self.keepsakes(self.ana))
        # Switching back later doesn't take it away.
        Account.objects.filter(user=self.ana).update(language="en")
        self.attend(self.ana, self.event(language="en"))
        self.assertIn("ambassador", self.keepsakes(self.ana))

    def test_familiar_face_needs_three_months_in_a_row(self):
        for month in (1, 3, 4):  # a gap in February
            self.attend(self.ana, self.event(starts=denver(2025, month, 10, 18)))
        self.assertNotIn("familiar_face", self.keepsakes(self.ana))
        self.attend(self.ana, self.event(starts=denver(2025, 5, 10, 18)))  # Mar, Apr, May
        self.assertIn("familiar_face", self.keepsakes(self.ana))

    def test_familiar_face_runs_across_new_year(self):
        for year, month in ((2024, 11), (2024, 12), (2025, 1)):
            self.attend(self.ana, self.event(starts=denver(year, month, 10, 18)))
        self.assertIn("familiar_face", self.keepsakes(self.ana))

    def test_year_rounder_needs_all_four_seasons_in_any_years(self):
        for year, month in ((2023, 1), (2024, 4), (2025, 7)):
            self.attend(self.ana, self.event(starts=denver(year, month, 10, 18)))
        self.assertNotIn("year_rounder", self.keepsakes(self.ana))
        self.attend(self.ana, self.event(starts=denver(2025, 10, 10, 18)))
        self.assertIn("year_rounder", self.keepsakes(self.ana))

    def test_keepsakes_are_celebrated_once(self):
        from accounts.models import Account

        Account.objects.filter(user=self.ana).update(language="es")
        self.attend(self.ana, self.event())
        self.attend(self.ana, self.event())
        self.assertEqual(Celebration.objects.filter(user=self.ana, badge_key="ambassador").count(), 1)


class NeverDemoteTests(BadgeTestCase):
    def test_raising_a_threshold_keeps_the_stage(self):
        for _ in range(3):
            self.attend(self.ana, self.event())
        self.assertEqual(self.state(self.ana, "local"), (2, 3))
        with mock.patch.dict(config.TRACK_THRESHOLDS, {"everyday": [5, 10, 20, 40, 80]}):
            self.attend(self.ana, self.event())
        self.assertEqual(self.state(self.ana, "local"), (2, 4))

    def test_a_deleted_attendee_never_lowers_the_hosts_stage(self):
        event = self.event()
        leaver = self.member("leaver")
        self.attend(leaver, event)
        self.attend(self.ana, event)
        self.assertEqual(self.state(self.host, "host"), (1, 2))
        self.api(leaver).post("/api/account/delete", {"password": "x"}, format="json")
        stage, count = self.state(self.host, "host")
        self.assertEqual(stage, 1)
        self.assertEqual(count, 1)  # the true count, shown as is


class GroveMilestoneTests(BadgeTestCase):
    def test_celebrates_at_two_and_three_times_grove(self):
        with mock.patch.dict(config.TRACK_THRESHOLDS, {"occasional": [1, 2, 3, 4, 5]}):
            for _ in range(15):
                self.attend(self.ana, self.event(category="cleanup"))
        milestones = Celebration.objects.filter(user=self.ana, badge_key="clean_sweeper", kind="grove_milestone")
        self.assertEqual(list(milestones.values_list("count", flat=True)), [10, 15])
        self.assertEqual(BadgeState.objects.get(user=self.ana, badge_key="clean_sweeper").grove_milestones_celebrated, 2)
