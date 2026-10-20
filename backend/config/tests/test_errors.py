"""Error replies keep their useful headers, and unknown addresses and crashes answer with a code too."""

from unittest import mock

from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


class ErrorReplyTests(APITestCase):
    @override_settings(CACHES=LOCMEM)
    def test_throttled_reply_says_when_to_try_again(self):
        cache.clear()
        for _ in range(21):
            response = self.client.post("/api/auth/login", {"email": "x@example.com", "password": "x"}, format="json")
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.data, {"code": "throttled"})
        self.assertGreater(int(response["Retry-After"]), 0)

    def test_not_logged_in_reply_says_how_to_log_in(self):
        response = self.client.get("/api/profile/me")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response["WWW-Authenticate"], "Token")

    def test_unknown_api_address_answers_with_a_code(self):
        response = self.client.get("/api/no-such-thing")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"code": "not_found"})

    def test_a_crash_answers_with_a_code(self):
        self.client.raise_request_exception = False
        with mock.patch("config.views.config_json", side_effect=RuntimeError("bug")):
            response = self.client.get("/api/config")
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json(), {"code": "server_error"})


class MinAppVersionTests(APITestCase):
    def test_config_says_which_app_versions_still_work(self):
        self.assertEqual(self.client.get("/api/config").data["min_app_version"], "")
        with self.settings(MIN_APP_VERSION="1.2.0"):
            self.assertEqual(self.client.get("/api/config").data["min_app_version"], "1.2.0")
