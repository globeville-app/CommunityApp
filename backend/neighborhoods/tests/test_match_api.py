import logging
from unittest import mock

import httpx
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import override_settings
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from geocoding.testing import NO_MATCH_REPLY, census_reply, fake_geocoder
from neighborhoods.models import NeighborhoodMatch
from neighborhoods.testing import FixtureNeighborhoodsMixin

ADDRESS = "3300 Example Blvd Unit 2B, Denver, CO 80211"


class MatchApiTests(FixtureNeighborhoodsMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.user = get_user_model().objects.create_user(username="ana@example.com", password="x")
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    def match(self, address=ADDRESS):
        return self.client.post("/api/join/match", {"address": address}, format="json")

    def test_match_returns_neighborhood_and_aliases(self):
        with fake_geocoder(census_reply(*self.HIGHLAND)):
            response = self.match()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"neighborhood_id": 3, "name": "Highland", "aliases": ["LoHi"]})

    def test_match_without_aliases(self):
        with fake_geocoder(census_reply(*self.EAST)):
            response = self.match()
        self.assertEqual(response.data["name"], "East Square")
        self.assertEqual(response.data["aliases"], [])

    def test_match_is_remembered_on_the_server(self):
        with fake_geocoder(census_reply(*self.WEST)):
            self.match()
        self.assertEqual(NeighborhoodMatch.objects.get(user=self.user).neighborhood_id, 2)
        # Matching again replaces it (e.g. after "Edit address").
        with fake_geocoder(census_reply(*self.EAST)):
            self.match()
        self.assertEqual(NeighborhoodMatch.objects.get(user=self.user).neighborhood_id, 1)

    def test_response_never_contains_the_address_or_coordinates(self):
        with fake_geocoder(census_reply(*self.HIGHLAND)):
            body = self.match().content.decode()
        self.assertNotIn("Example", body)
        self.assertNotIn(str(self.HIGHLAND[0]), body)

    def test_outside_denver(self):
        with fake_geocoder(census_reply(*self.OUTSIDE)):
            response = self.match()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "outside_denver")
        self.assertEqual(
            response.data["detail"],
            f"{settings.APP_NAME} is only in the City and County of Denver for now.",
        )
        self.assertFalse(NeighborhoodMatch.objects.exists())

    def test_no_match(self):
        with fake_geocoder(NO_MATCH_REPLY):
            response = self.match()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "no_match")
        self.assertEqual(
            response.data["detail"], "We couldn't find that address. Check the spelling and try again."
        )

    def test_geocoder_timeout_is_a_friendly_503(self):
        with fake_geocoder(error=httpx.ReadTimeout):
            response = self.match()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["code"], "geocoder_unavailable")
        self.assertNotIn("Example", response.content.decode())

    def test_blank_address_is_rejected_without_calling_geocoder(self):
        patcher = fake_geocoder(census_reply(*self.EAST))
        with patcher:
            response = self.match("   ")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(patcher.requests, [])

    def test_requires_login(self):
        self.client.credentials()
        self.assertEqual(self.match().status_code, 401)

    def test_unexpected_error_hides_address_in_reply_and_logs(self):
        with fake_geocoder(census_reply(*self.EAST)), mock.patch(
            "neighborhoods.views.get_boundaries",
            side_effect=ValueError(f"bad point {self.EAST} for {ADDRESS}"),
        ), self.assertLogs(level=logging.DEBUG) as logs:
            response = self.match()
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.data["code"], "server_error")
        everything = response.content.decode() + "\n".join(logs.output)
        self.assertNotIn("Example", everything)
        self.assertNotIn(str(self.EAST[0]), everything)
        self.assertIn("ValueError", "\n".join(logs.output))


class MatchThrottleTests(FixtureNeighborhoodsMixin, APITestCase):
    @override_settings(CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}})
    def test_too_many_matches_are_slowed_down(self):
        cache.clear()
        user = get_user_model().objects.create_user(username="bo@example.com", password="x")
        self.client.force_authenticate(user)
        with fake_geocoder(census_reply(*self.EAST)):
            codes = [
                self.client.post("/api/join/match", {"address": ADDRESS}, format="json").status_code
                for _ in range(11)
            ]
        self.assertEqual(codes[:10], [200] * 10)
        self.assertEqual(codes[10], 429)
        cache.clear()
