"""
The most important promise of this milestone: the street address is never
stored. We run the whole join flow, then search every database table, every
uploaded file, every response and all log output for the address and its
coordinates. We expect zero hits.
"""

import logging
import shutil
import tempfile
from pathlib import Path

from django.db import connection
from django.test import override_settings
from rest_framework.test import APITestCase

from geocoding.testing import census_reply, fake_geocoder
from neighborhoods.testing import FixtureNeighborhoodsMixin
from profiles.testing import exif_with_gps, image_bytes, upload

# Unusual values so a hit can only come from this test.
ADDRESS = "4242 Zzyzx Privacy Ln Apt 9, Denver, CO 80211"
LAT, LON = 39.857731, -104.953319  # inside the fixture's "Highland" square
SECRETS = ["Zzyzx", "4242", "Privacy Ln", "39.857731", "-104.953319", "39.8577", "-104.9533"]

TEMP_MEDIA = tempfile.mkdtemp(prefix="test-media-")


@override_settings(MEDIA_ROOT=TEMP_MEDIA)
class AddressIsNeverStoredTests(FixtureNeighborhoodsMixin, APITestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(TEMP_MEDIA, ignore_errors=True)
        super().tearDownClass()

    def test_full_flow_leaves_no_trace_of_the_address(self):
        responses = []
        with self.assertLogs(level=logging.DEBUG) as logs:
            logging.getLogger("privacy-test").debug("capturing all log output")
            responses += self.run_join_flow()
        log_output = "\n".join(logs.output)

        for secret in SECRETS:
            with self.subTest(secret=secret):
                self.assertEqual(self.database_hits(secret), [], "found in the database")
                self.assertEqual(self.file_hits(secret), [], "found in an uploaded file")
                self.assertNotIn(secret, log_output, "found in the logs")
                for response in responses:
                    self.assertNotIn(secret, response.content.decode(errors="ignore"))

    def run_join_flow(self):
        c = self.client
        r = [c.post("/api/auth/signup", {"email": "zed@example.com", "password": "a long pass phrase 9"}, format="json")]
        r.append(c.post("/api/auth/login", {"email": "zed@example.com", "password": "a long pass phrase 9"}, format="json"))
        c.credentials(HTTP_AUTHORIZATION=f"Token {r[-1].data['token']}")

        with fake_geocoder(census_reply(LAT, LON)):
            r.append(c.post("/api/join/match", {"address": ADDRESS}, format="json"))
        self.assertEqual(r[-1].status_code, 200)
        self.assertEqual(r[-1].data["name"], "Highland")

        r.append(c.put("/api/profile", {"first_name": "Zed", "last_name": "Q", "alias": "LoHi", "interests": ["cleanup"]}, format="json"))
        self.assertEqual(r[-1].status_code, 201)
        r.append(c.post("/api/profile/photo", {"photo": upload(image_bytes(exif=exif_with_gps()))}, format="multipart"))
        self.assertEqual(r[-1].status_code, 200)
        r.append(c.get("/api/profile/me"))
        self.assertEqual(r[-1].data["display_name"], "Zed Q.")
        return r

    def database_hits(self, secret):
        """Look through every row of every table, as text."""
        hits = []
        with connection.cursor() as cursor:
            for table in connection.introspection.table_names():
                cursor.execute(f'SELECT * FROM "{table}"')
                for row in cursor.fetchall():
                    if secret in " ".join(str(value) for value in row):
                        hits.append(table)
        return hits

    def file_hits(self, secret):
        return [
            str(path)
            for path in Path(TEMP_MEDIA).rglob("*")
            if path.is_file() and secret.encode() in path.read_bytes()
        ]

    def test_the_scan_really_finds_things(self):
        # Guard against a scan that silently checks nothing.
        self.client.post("/api/auth/signup", {"email": "zzyzx@example.com", "password": "a long pass phrase 9"}, format="json")
        self.assertIn("auth_user", self.database_hits("zzyzx"))

    def test_no_model_has_an_address_or_coordinate_field(self):
        from django.apps import apps

        forbidden = ("address", "street", "lat", "lon", "lng", "coord", "geocod")
        for model in apps.get_models():
            if model._meta.app_label not in ("accounts", "neighborhoods", "profiles", "geocoding"):
                continue
            for field in model._meta.get_fields():
                with self.subTest(model=model.__name__, field=field.name):
                    # Word starts, so "latitude" and "home_address" are caught
                    # but "cancellation" (which contains "lat") isn't.
                    parts = field.name.lower().split("_")
                    self.assertFalse(any(part.startswith(word) for part in parts for word in forbidden))
