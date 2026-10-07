"""Fake geocoder responses for tests. Tests never call the real network."""

from unittest import mock

import httpx


def census_reply(lat, lon):
    """A trimmed-down copy of what the Census Geocoder sends for a match."""
    return {
        "result": {
            "input": {"benchmark": {"benchmarkName": "Public_AR_Current"}},
            "addressMatches": [
                {
                    "matchedAddress": "(matched address)",
                    "coordinates": {"x": lon, "y": lat},
                }
            ],
        }
    }


NO_MATCH_REPLY = {"result": {"addressMatches": []}}


def fake_geocoder(reply=None, status=200, error=None):
    """
    Patch the geocoder so requests go to a fake server.

    reply: the JSON to send back. error: an httpx exception to raise instead
    (e.g. httpx.ReadTimeout). Returns a patcher; the list of requests the fake
    received is available as `patcher.requests`.
    """
    requests = []

    def handle(request):
        requests.append(request)
        if error is not None:
            raise error("simulated failure", request=request)
        return httpx.Response(status, json=reply)

    patcher = mock.patch("geocoding.client.get_transport", return_value=httpx.MockTransport(handle))
    patcher.requests = requests
    return patcher
