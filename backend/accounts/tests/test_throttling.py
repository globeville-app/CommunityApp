"""Login limits can't be dodged by faking the X-Forwarded-For header (review S1)."""

from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
LIMIT = 20  # "auth": 20/min in config/settings.py


@override_settings(CACHES=LOCMEM)
class LoginThrottleTests(APITestCase):
    def setUp(self):
        cache.clear()

    def wrong_login(self, **headers):
        return self.client.post(
            "/api/auth/login", {"email": "x@example.com", "password": "wrong"}, format="json", **headers
        ).status_code

    def test_a_made_up_forwarded_for_on_every_try_is_still_limited(self):
        codes = [self.wrong_login(HTTP_X_FORWARDED_FOR=f"10.0.0.{i}") for i in range(LIMIT + 5)]
        self.assertEqual(codes[:LIMIT], [400] * LIMIT)
        self.assertEqual(set(codes[LIMIT:]), {429})

    @override_settings(CLIENT_IP_HEADER="DO-Connecting-IP")
    def test_the_hosts_header_tells_callers_apart(self):
        for _ in range(LIMIT):
            self.wrong_login(HTTP_DO_CONNECTING_IP="203.0.113.1")
        self.assertEqual(self.wrong_login(HTTP_DO_CONNECTING_IP="203.0.113.1"), 429)
        # Someone else behind the same proxy isn't blocked.
        self.assertEqual(self.wrong_login(HTTP_DO_CONNECTING_IP="203.0.113.2"), 400)


DATABASE_CACHE = {"default": {"BACKEND": "django.core.cache.backends.db.DatabaseCache", "LOCATION": "cache_table"}}


class SharedCountsTests(APITestCase):
    """Production keeps the counts in the database, shared by every server process (review G1)."""

    def test_limits_work_with_the_database_cache(self):
        from django.core.management import call_command

        with self.settings(CACHES=DATABASE_CACHE):
            call_command("createcachetable", verbosity=0)
            cache.clear()
            codes = [
                self.client.post("/api/auth/login", {"email": "x@example.com", "password": "x"}, format="json").status_code
                for _ in range(LIMIT + 1)
            ]
        self.assertEqual(codes[-1], 429)

    def test_production_uses_the_database_cache(self):
        from config.tests.test_production import PRODUCTION_ENV, run_manage

        code = "from django.conf import settings; print(settings.CACHES['default']['BACKEND'])"
        result = run_manage("shell", "-c", code, env=PRODUCTION_ENV)
        self.assertIn("DatabaseCache", result.stdout, result.stderr)
