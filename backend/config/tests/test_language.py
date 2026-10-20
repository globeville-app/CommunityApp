"""
English and Spanish (docs/LANGUAGE.md): the member's language is saved from
signup on, can be changed later, and the server never sends sentences, only
codes the app translates.
"""

import re

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from accounts.models import Account
from geocoding.testing import NO_MATCH_REPLY, census_reply, fake_geocoder
from neighborhoods.testing import FixtureNeighborhoodsMixin
from accounts.testing import confirm_email

PASSWORD = "a long pass phrase"

CODE = re.compile(r"^[a-z][a-z0-9_]*$")


class LanguageTests(FixtureNeighborhoodsMixin, APITestCase):
    def signup(self, **extra):
        body = {"email": "ana@example.com", "password": PASSWORD, **extra}
        return self.client.post("/api/auth/signup", body, format="json")

    def log_in_with(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")
        confirm_email(self.client)

    def test_language_is_saved_at_signup(self):
        response = self.signup(language="es")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["language"], "es")
        self.assertEqual(Account.objects.get().language, "es")

    def test_signup_defaults_to_english(self):
        self.assertEqual(self.signup().data["language"], "en")
        self.assertEqual(Account.objects.get().language, "en")

    def test_signup_rejects_other_languages(self):
        response = self.signup(language="fr")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "invalid_language")
        self.assertFalse(get_user_model().objects.exists())

    def test_login_returns_the_saved_language(self):
        self.signup(language="es")
        response = self.client.post(
            "/api/auth/login", {"email": "ana@example.com", "password": PASSWORD}, format="json"
        )
        self.assertEqual(response.data["language"], "es")

    def test_patch_changes_the_language_even_before_the_profile_exists(self):
        self.log_in_with(self.signup().data["token"])
        response = self.client.patch("/api/profile/me", {"language": "es"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"language": "es"})
        self.assertEqual(Account.objects.get().language, "es")

    def test_patch_rejects_other_languages(self):
        self.log_in_with(self.signup(language="es").data["token"])
        response = self.client.patch("/api/profile/me", {"language": "de"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "invalid_language")
        self.assertEqual(Account.objects.get().language, "es")

    def test_profile_shows_and_saves_the_language(self):
        self.log_in_with(self.signup(language="es").data["token"])
        with fake_geocoder(census_reply(*self.HIGHLAND)):
            self.client.post("/api/join/match", {"address": "1 Main St"}, format="json")
        body = {"first_name": "Ana", "last_name": "R", "interests": ["gardening"]}
        self.assertEqual(self.client.put("/api/profile", body, format="json").data["language"], "es")
        response = self.client.put("/api/profile", {**body, "language": "en"}, format="json")
        self.assertEqual(response.data["language"], "en")
        self.assertEqual(self.client.get("/api/profile/me").data["language"], "en")

    def test_users_from_before_languages_read_as_english(self):
        get_user_model().objects.create_user(username="old@example.com", password="x")
        self.assertEqual(
            self.client.post(
                "/api/auth/login", {"email": "old@example.com", "password": "x"}, format="json"
            ).data["language"],
            "en",
        )


class ErrorsAreCodesTests(FixtureNeighborhoodsMixin, APITestCase):
    """Every error the app can get back is a code, never a sentence."""

    def assert_only_codes(self, response):
        self.assertGreaterEqual(response.status_code, 400, response.data)
        self.assertLessEqual(set(response.data), {"code", "fields"})
        self.assertRegex(response.data["code"], CODE)
        for codes in response.data.get("fields", {}).values():
            for code in codes:
                self.assertRegex(code, CODE)

    def test_error_responses(self):
        signup = {"email": "ana@example.com", "password": PASSWORD}
        token = self.client.post("/api/auth/signup", signup, format="json").data["token"]
        responses = [
            self.client.post("/api/auth/signup", signup, format="json"),  # email taken
            self.client.post("/api/auth/signup", {"email": "nope", "password": "123"}, format="json"),
            self.client.post("/api/auth/signup", {}, format="json"),
            self.client.post("/api/auth/login", {"email": "ana@example.com", "password": "no"}, format="json"),
            self.client.get("/api/profile/me"),  # not logged in
        ]
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")
        responses.append(self.client.get("/api/profile/me"))  # email not confirmed yet
        confirm_email(self.client)
        responses.append(self.client.get("/api/profile/me"))  # no profile yet
        responses.append(self.client.put("/api/profile", {"first_name": "Ana", "last_name": "R"}, format="json"))
        with fake_geocoder(NO_MATCH_REPLY):
            responses.append(self.client.post("/api/join/match", {"address": "nowhere"}, format="json"))
        responses.append(self.client.post("/api/join/match", {"address": ""}, format="json"))
        with fake_geocoder(census_reply(*self.HIGHLAND)):
            self.client.post("/api/join/match", {"address": "1 Main St"}, format="json")
        responses.append(
            self.client.put(
                "/api/profile",
                {"first_name": "", "last_name": "R", "alias": "Nope", "interests": ["Gardening"]},
                format="json",
            )
        )
        responses.append(self.client.post("/api/profile/photo", {}, format="multipart"))

        for response in responses:
            with self.subTest(code=response.data.get("code")):
                self.assert_only_codes(response)
        self.assertEqual(
            [r.data["code"] for r in responses],
            [
                "email_taken",
                "invalid_email",
                "invalid_email",
                "invalid_credentials",
                "not_authenticated",
                "email_not_verified",
                "profile_not_found",
                "match_required",
                "no_match",
                "invalid_address",
                "invalid_first_name",
                "profile_not_found",
            ],
        )
