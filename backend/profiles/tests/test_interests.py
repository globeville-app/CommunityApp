"""Interests are event category keys (docs/MILESTONE_2.md)."""

import importlib

from profiles.models import Profile
from profiles.tests.test_profile_api import ProfileTestCase

migration = importlib.import_module("profiles.migrations.0004_interests_to_categories")


class InterestTests(ProfileTestCase):
    def setUp(self):
        super().setUp()
        self.match(self.HIGHLAND)
        self.save_profile()

    def patch(self, interests):
        return self.client.patch("/api/profile/me", {"interests": interests}, format="json")

    def test_patch_accepts_category_keys(self):
        response = self.patch(["potluck", "game_night", "gardening"])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["interests"], ["potluck", "game_night", "gardening"])
        self.assertEqual(Profile.objects.get().interests, ["potluck", "game_night", "gardening"])

    def test_patch_accepts_none(self):
        self.patch(["potluck"])
        self.assertEqual(self.patch([]).data["interests"], [])

    def test_rejected_interests(self):
        nine = ["block_party", "potluck", "festival", "parade", "market", "swap", "comedy", "fitness", "expo"]
        cases = [
            (["skydiving"], "invalid_interest"),
            (["block_parties"], "invalid_interest"),  # a Milestone 1 key
            (["other"], "invalid_interest"),
            (["potluck", "potluck"], "invalid_interest"),
            ("potluck", "invalid_interest"),
            (nine, "too_many_interests"),
        ]
        for interests, code in cases:
            with self.subTest(interests=interests):
                response = self.patch(interests)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.data["code"], code)
        self.assertEqual(Profile.objects.get().interests, [])

    def test_eight_is_fine(self):
        eight = ["block_party", "potluck", "festival", "parade", "market", "swap", "comedy", "fitness"]
        self.assertEqual(self.patch(eight).status_code, 200)

    def test_profile_setup_uses_the_same_rules(self):
        self.assertEqual(self.save_profile(interests=["other"]).data["code"], "invalid_interest")
        self.assertEqual(self.save_profile(interests=["cleanup"]).data["interests"], ["cleanup"])


class InterestMigrationTests(ProfileTestCase):
    def test_converts_the_five_old_keys(self):
        old = ["block_parties", "food_drives", "cleanups", "live_music", "gardening"]
        self.assertEqual(
            migration.convert(old),
            (["block_party", "donation_drive", "cleanup", "live_music", "gardening"], 0),
        )

    def test_drops_unknown_keys_and_counts_them(self):
        self.assertEqual(migration.convert(["gardening", "Skydiving", "knitting"]), (["gardening"], 2))
        self.assertEqual(migration.convert([]), ([], 0))
        self.assertEqual(migration.convert(None), ([], 0))

    def test_logs_only_a_count(self):
        from django.apps import apps

        self.match(self.HIGHLAND)
        self.save_profile()
        Profile.objects.update(interests=["cleanups", "Secret Club"])
        with self.assertLogs(migration.logger, level="WARNING") as logs:
            migration.forwards(apps, None)
        self.assertEqual(Profile.objects.get().interests, ["cleanup"])
        self.assertEqual(logs.output, [f"WARNING:{migration.logger.name}:Interests migration dropped 1 unrecognized interest keys"])
        self.assertNotIn("ana", "".join(logs.output).lower())
