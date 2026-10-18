"""The attendance, badge and celebration endpoints."""

from datetime import timedelta
from unittest import mock

from django.utils import timezone

from badges.models import Attendance, BadgeState, Celebration, DeclineLog, Keepsake, ShareLog
from badges.tests.helpers import BadgeTestCase
from events.models import Event, Going
from profiles.models import Profile

NOW = timezone.now()


def at(when):
    return mock.patch("django.utils.timezone.now", return_value=when)


class CollectAndDeclineTests(BadgeTestCase):
    def setUp(self):
        super().setUp()
        self.past = self.event(starts=NOW - timedelta(days=1), title="Alley Cleanup", category="cleanup")
        Going.objects.create(user=self.ana, event=self.past)
        self.client = self.api(self.ana)

    def test_card_appears_after_the_event_and_collect_works(self):
        cards = self.client.get("/api/me/collect").data["cards"]
        self.assertEqual([c["title"] for c in cards], ["Alley Cleanup"])
        grows = {g["badge"]: g for g in cards[0]["grows"]}
        self.assertEqual(set(grows), {"local", "best_guest", "helping_hand", "clean_sweeper"})
        self.assertEqual(grows["clean_sweeper"], {"badge": "clean_sweeper", "stage": 0, "count": 0, "next_threshold": 1})

        response = self.client.post(f"/api/events/{self.past.pk}/collect")
        self.assertEqual(response.status_code, 201)
        self.assertIn("clean_sweeper", [c["badge_key"] for c in response.data["celebrations"]])
        self.assertEqual(self.client.get("/api/me/collect").data["cards"], [])
        again = self.client.post(f"/api/events/{self.past.pk}/collect")
        self.assertEqual(again.data, {"code": "already_recorded"})

    def test_no_card_before_the_event_ends(self):
        Going.objects.create(user=self.ana, event=self.event(starts=NOW + timedelta(days=1)))
        self.assertEqual(len(self.client.get("/api/me/collect").data["cards"]), 1)

    def test_decline_removes_from_going_and_cards_and_counts_nothing(self):
        response = self.client.post(f"/api/events/{self.past.pk}/decline")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Going.objects.filter(event=self.past).exists())  # off the going count
        self.assertEqual(self.client.get("/api/me/collect").data["cards"], [])
        self.assertFalse(Attendance.objects.exists())
        self.assertFalse(BadgeState.objects.filter(count__gt=0).exists())
        self.assertEqual(DeclineLog.objects.count(), 1)
        self.assertEqual(self.client.post(f"/api/events/{self.past.pk}/collect").data, {"code": "not_going"})

    def test_ignored_cards_disappear_after_7_days(self):
        with at(NOW + timedelta(days=6)):
            self.assertEqual(len(self.client.get("/api/me/collect").data["cards"]), 1)
        with at(NOW + timedelta(days=8)):
            self.assertEqual(self.client.get("/api/me/collect").data["cards"], [])
            self.assertEqual(self.client.post(f"/api/events/{self.past.pk}/collect").data, {"code": "collect_window_closed"})
        self.assertTrue(Going.objects.filter(event=self.past).exists())  # still in the going count

    def test_sensitive_categories_show_no_hints(self):
        fair = self.event(starts=NOW - timedelta(days=1), category="resource_fair")
        Going.objects.create(user=self.ana, event=fair)
        cards = {c["event_id"]: c for c in self.client.get("/api/me/collect").data["cards"]}
        self.assertEqual(cards[fair.pk]["grows"], [])

    def test_hosts_never_see_who_declined(self):
        self.client.post(f"/api/events/{self.past.pk}/decline")
        host = self.api(self.host)
        detail = host.get(f"/api/events/{self.past.pk}").content.decode()
        self.assertNotIn("decline", detail)
        self.assertEqual(host.get("/api/me/impact").data, {})


class CheckinTests(BadgeTestCase):
    def setUp(self):
        super().setUp()
        self.live = self.event(starts=NOW - timedelta(minutes=10))
        Going.objects.create(user=self.ana, event=self.live)
        self.client = self.api(self.ana)

    def test_checkin_records_attendance(self):
        response = self.client.post(f"/api/events/{self.live.pk}/checkin")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Attendance.objects.get().method, "auto")

    def test_checkin_accepts_no_location_and_stores_none(self):
        body = {"latitude": 39.761234, "longitude": -105.011234}
        response = self.client.post(f"/api/events/{self.live.pk}/checkin", body, format="json")
        self.assertEqual(response.data, {"code": "body_not_accepted"})
        self.assertFalse(Attendance.objects.exists())
        field_names = {f.name for f in Attendance._meta.get_fields()}
        self.assertFalse(field_names & {"latitude", "longitude", "location", "coordinates", "accuracy"})

    def test_other_neighborhoods_get_404(self):
        outsider = self.member("out", self.hale)
        response = self.api(outsider).post(f"/api/events/{self.live.pk}/checkin")
        self.assertEqual(response.status_code, 404)


class GeofenceTests(BadgeTestCase):
    def test_at_most_20_upcoming_events_with_pins(self):
        for i in range(25):
            Going.objects.create(user=self.ana, event=self.event(starts=NOW + timedelta(days=i + 1)))
        pinless = self.event(starts=NOW + timedelta(hours=2), latitude=None, longitude=None)
        Going.objects.create(user=self.ana, event=pinless)
        cancelled = self.event(starts=NOW + timedelta(hours=1), status="cancelled")
        Going.objects.create(user=self.ana, event=cancelled)
        fences = self.api(self.ana).get("/api/me/geofences").data["geofences"]
        self.assertEqual(len(fences), 20)
        ids = [f["event_id"] for f in fences]
        self.assertNotIn(pinless.pk, ids)
        self.assertNotIn(cancelled.pk, ids)
        self.assertEqual(fences[0]["radius_meters"], 150)
        self.assertEqual(set(fences[0]), {"event_id", "latitude", "longitude", "radius_meters", "opens_at", "closes_at"})


class MemberBadgeTests(BadgeTestCase):
    def setUp(self):
        super().setUp()
        self.attend(self.ana, self.event(category="cleanup"))
        self.ana_id = Profile.objects.get(user=self.ana).pk

    def test_neighbors_see_earned_badges(self):
        ben = self.member("ben")
        data = self.api(ben).get(f"/api/members/{self.ana_id}").data
        self.assertEqual(data["display_name"], "Ana R.")
        keys = [b["key"] for b in data["badges"]]
        self.assertIn("clean_sweeper", keys)
        self.assertNotIn("fiestero", keys)  # only earned ones
        self.assertNotIn("email", str(data))

    def test_other_neighborhoods_get_404(self):
        outsider = self.member("out", self.hale)
        self.assertEqual(self.api(outsider).get(f"/api/members/{self.ana_id}/badges").status_code, 404)

    def test_only_me_hides_them_from_neighbors_but_not_from_me(self):
        Profile.objects.filter(user=self.ana).update(badge_visibility="private")
        ben = self.member("ben")
        self.assertEqual(self.api(ben).get(f"/api/members/{self.ana_id}/badges").data, {"badges": []})
        mine = self.api(self.ana).get("/api/me/badges").data["badges"]
        self.assertEqual(len(mine), 15)
        self.assertEqual({b["key"]: b["stage"] for b in mine}["clean_sweeper"], 1)

    def test_visibility_and_auto_checkin_are_profile_settings(self):
        client = self.api(self.ana)
        response = client.patch("/api/profile/me", {"badge_visibility": "private", "auto_checkin": True}, format="json")
        self.assertEqual((response.data["badge_visibility"], response.data["auto_checkin"]), ("private", True))
        bad = client.patch("/api/profile/me", {"badge_visibility": "everyone"}, format="json")
        self.assertEqual(bad.data["code"], "invalid_badge_visibility")


class CelebrationAndShareTests(BadgeTestCase):
    def test_unseen_celebrations_then_seen(self):
        self.attend(self.ana, self.event(category="cleanup"))
        client = self.api(self.ana)
        unseen = client.get("/api/me/celebrations").data["celebrations"]
        self.assertEqual({c["badge_key"] for c in unseen}, {"local", "clean_sweeper", "helping_hand"})
        client.post("/api/me/celebrations/seen", {"ids": [unseen[0]["id"]]}, format="json")
        self.assertEqual(len(client.get("/api/me/celebrations").data["celebrations"]), 2)
        client.post("/api/me/celebrations/seen", {}, format="json")
        self.assertEqual(client.get("/api/me/celebrations").data["celebrations"], [])

    def test_share_log_has_no_member(self):
        client = self.api(self.ana)
        self.assertEqual(client.post("/api/badges/clean_sweeper/shared").status_code, 204)
        self.assertEqual(client.post("/api/badges/not_a_badge/shared").status_code, 404)
        self.assertEqual(ShareLog.objects.count(), 1)
        self.assertEqual({f.name for f in ShareLog._meta.get_fields()}, {"id", "badge_key", "date"})

    def test_catalog_comes_from_config(self):
        data = self.api(self.ana).get("/api/badges/catalog").data
        self.assertEqual(len(data["badges"]), 15)
        local = next(b for b in data["badges"] if b["key"] == "local")
        self.assertEqual(local["thresholds"], [1, 3, 9, 24, 60])
        self.assertEqual(data["stages"], ["seed", "sprout", "bloom", "tree", "grove"])


class ReofferTests(BadgeTestCase):
    def setUp(self):
        super().setUp()
        self.client = self.api(self.ana)
        self.client.post("/api/me/checkin-offer/seen", {"which": "first"}, format="json")
        Profile.objects.filter(user=self.ana).update(checkin_offer_shown_at=NOW - timedelta(days=40))

    def missed(self, n, days_ago=20):
        for i in range(n):
            Going.objects.create(user=self.ana, event=self.event(starts=NOW - timedelta(days=days_ago + i)))

    def flag(self):
        return self.client.get("/api/me/collect").data["show_checkin_reoffer"]

    def test_turns_on_after_three_expired_uncollected_cards(self):
        self.missed(2)
        self.assertFalse(self.flag())
        self.missed(1, days_ago=30)
        self.assertTrue(self.flag())
        self.client.post("/api/me/checkin-offer/seen", {"which": "reoffer"}, format="json")
        self.assertFalse(self.flag())  # once, ever

    def test_declines_dont_count(self):
        self.missed(2)
        declined = self.event(starts=NOW - timedelta(days=1))
        Going.objects.create(user=self.ana, event=declined)
        self.client.post(f"/api/events/{declined.pk}/decline")
        with at(NOW + timedelta(days=10)):
            self.assertFalse(self.flag())

    def test_never_for_members_who_collect_or_have_it_on(self):
        self.missed(3)
        recent = self.event(starts=NOW - timedelta(days=1))
        Going.objects.create(user=self.ana, event=recent)
        self.client.post(f"/api/events/{recent.pk}/collect")
        self.assertFalse(self.flag())
        Attendance.objects.all().delete()
        Profile.objects.filter(user=self.ana).update(auto_checkin=True)
        self.assertFalse(self.flag())


class DeletedAccountTests(BadgeTestCase):
    def test_deleting_removes_attendance_badges_and_celebrations(self):
        from django.contrib.auth.hashers import make_password

        type(self.ana).objects.filter(pk=self.ana.pk).update(password=make_password("pw"))
        self.attend(self.ana, self.event())
        from accounts.models import Account  # noqa: F401  (Ana's account exists)

        Keepsake.objects.create(user=self.ana, badge_key="ambassador")
        self.api(self.ana).post("/api/account/delete", {"password": "pw"}, format="json")
        for model in (Attendance, BadgeState, Keepsake, Celebration):
            self.assertFalse(model.objects.filter(user_id=self.ana.pk).exists(), model.__name__)
