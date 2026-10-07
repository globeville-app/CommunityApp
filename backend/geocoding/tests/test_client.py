import logging

import httpx
from django.test import SimpleTestCase

from geocoding.client import GeocoderUnavailable, geocode
from geocoding.testing import NO_MATCH_REPLY, census_reply, fake_geocoder

ADDRESS = "1234 Example St Apt 5, Denver, CO 80211"


class GeocodeTests(SimpleTestCase):
    def test_success_returns_lat_lon(self):
        with fake_geocoder(census_reply(39.7621, -105.0105)):
            self.assertEqual(geocode(ADDRESS), (39.7621, -105.0105))

    def test_sends_the_documented_census_parameters(self):
        patcher = fake_geocoder(census_reply(39.7, -105.0))
        with patcher:
            geocode(ADDRESS)
        request = patcher.requests[0]
        self.assertEqual(request.url.host, "geocoding.geo.census.gov")
        self.assertEqual(request.url.params["address"], ADDRESS)
        self.assertEqual(request.url.params["benchmark"], "Public_AR_Current")
        self.assertEqual(request.url.params["format"], "json")

    def test_no_match_returns_none(self):
        with fake_geocoder(NO_MATCH_REPLY):
            self.assertIsNone(geocode(ADDRESS))

    def test_timeout_raises_unavailable(self):
        with fake_geocoder(error=httpx.ReadTimeout):
            with self.assertRaises(GeocoderUnavailable):
                geocode(ADDRESS)

    def test_connection_error_raises_unavailable(self):
        with fake_geocoder(error=httpx.ConnectError):
            with self.assertRaises(GeocoderUnavailable):
                geocode(ADDRESS)

    def test_server_error_raises_unavailable(self):
        with fake_geocoder({"error": "down"}, status=503):
            with self.assertRaises(GeocoderUnavailable):
                geocode(ADDRESS)

    def test_unexpected_reply_raises_unavailable(self):
        with fake_geocoder({"something": "else"}):
            with self.assertRaises(GeocoderUnavailable):
                geocode(ADDRESS)

    def test_errors_never_mention_the_address(self):
        # The original httpx error can contain the URL (and so the address).
        with fake_geocoder({"error": "down"}, status=500):
            try:
                geocode(ADDRESS)
            except GeocoderUnavailable as error:
                self.assertNotIn("Example", str(error))
                self.assertIsNone(error.__cause__)
                self.assertTrue(error.__suppress_context__)

    def test_nothing_is_logged_about_the_request(self):
        # httpx logs request URLs at INFO; our settings silence it.
        with self.assertLogs(level=logging.DEBUG) as logs:
            logging.getLogger("check").debug("start")  # assertLogs needs one record
            with fake_geocoder(census_reply(39.7621, -105.0105)):
                geocode(ADDRESS)
        output = "\n".join(logs.output)
        self.assertNotIn("Example", output)
        self.assertNotIn("39.7621", output)
