"""Helpers shared by tests in several apps."""

import io
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.test import override_settings

from .aliases import get_alias_map
from .geo import get_boundaries

FIXTURE_GEOJSON = Path(__file__).parent / "tests" / "fixtures" / "tiny_neighborhoods.geojson"

REAL_DATA_MISSING = not Path(settings.NEIGHBORHOODS_GEOJSON).exists()
REAL_DATA_SKIP_REASON = (
    "Denver neighborhood file not downloaded yet: see backend/data/SOURCE.md"
)


def clear_caches():
    """Forget loaded boundaries/aliases so a settings change takes effect."""
    get_boundaries.cache_clear()
    get_alias_map.cache_clear()


class FixtureNeighborhoodsMixin:
    """
    Use the three made-up squares in tests/fixtures instead of Denver.

    Squares: "East Square" (id 1), "West Square" (id 2), "Highland" (id 3).
    A point well inside each:
    """

    EAST = (39.75, -104.85)  # (lat, lon)
    WEST = (39.75, -104.95)
    HIGHLAND = (39.85, -104.95)
    OUTSIDE = (38.83, -104.82)  # Colorado Springs

    def setUp(self):
        super().setUp()
        self._settings = override_settings(NEIGHBORHOODS_GEOJSON=FIXTURE_GEOJSON)
        self._settings.enable()
        clear_caches()
        call_command("load_neighborhoods", stdout=io.StringIO())

    def tearDown(self):
        self._settings.disable()
        clear_caches()
        super().tearDown()
