"""
Turn a street address into a latitude/longitude.

Everything else in the app calls only `geocode(address)`. To switch
providers later (e.g. add a Nominatim fallback), change this file only.

Provider: the US Census Geocoder. Free, no API key.
https://geocoding.geo.census.gov/geocoder/

PRIVACY: the address and the coordinates are personal data. This module
never logs them, and its errors never contain them. In particular we raise
our own exceptions "from None", because the original httpx error message
can include the request URL, and the URL contains the address.
"""

import httpx
from django.conf import settings


class GeocoderUnavailable(Exception):
    """The geocoding service is down, slow, or sent something unexpected."""


def get_transport():
    """
    Where HTTP requests go. None means "the real internet".
    Tests replace this with a fake so they never call the real service.
    """
    return None


def geocode(address):
    """
    Return (latitude, longitude) for the address, or None if no match was found.

    Raises GeocoderUnavailable if the service can't be reached in time.
    """
    params = {
        "address": address,
        "benchmark": "Public_AR_Current",
        "format": "json",
    }
    try:
        with httpx.Client(
            timeout=settings.GEOCODER_TIMEOUT_SECONDS, transport=get_transport()
        ) as client:
            response = client.get(settings.GEOCODER_URL, params=params)
            response.raise_for_status()
            matches = response.json()["result"]["addressMatches"]
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        # Timeout, connection problem, error status, or an unexpected reply.
        # "from None" drops the original error, which may contain the address.
        raise GeocoderUnavailable("The address lookup service is unavailable.") from None

    if not matches:
        return None

    try:
        coordinates = matches[0]["coordinates"]
        # Census uses x = longitude, y = latitude.
        return float(coordinates["y"]), float(coordinates["x"])
    except (KeyError, TypeError, ValueError):
        raise GeocoderUnavailable("The address lookup service is unavailable.") from None
