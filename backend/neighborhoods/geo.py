"""
Neighborhood boundaries and the "which neighborhood is this point in?" check.

The boundaries come from Denver's official Statistical Neighborhoods GeoJSON
file (see data/SOURCE.md). We read the file once and keep the polygons in
memory: 78 polygons is small, so a simple loop is fast enough and much
easier to follow than a spatial database.
"""

import hashlib
import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from django.conf import settings
from shapely import prepared
from shapely.geometry import Point, shape

# Property names in Denver's file. If the city renames them, change them here.
ID_FIELDS = ("NBHD_ID", "nbhd_id")
NAME_FIELDS = ("NBHD_NAME", "nbhd_name")


class NeighborhoodDataError(Exception):
    """The GeoJSON file is missing or not in the expected format."""


@dataclass(frozen=True)
class Area:
    id: int
    name: str
    geometry: object  # a shapely Polygon or MultiPolygon


class Boundaries:
    """All of Denver's neighborhoods, ready for point lookups."""

    def __init__(self, areas, source_version):
        # Sorted by ID so the boundary rule below is deterministic.
        self.areas = sorted(areas, key=lambda a: a.id)
        # Short fingerprint of the file, e.g. "a1b2c3d4e5f6".
        self.source_version = source_version
        # "Prepared" geometries make repeated point checks faster.
        self._fast_checks = [(a, prepared.prep(a.geometry)) for a in self.areas]

    def find(self, lat, lon):
        """
        Return the Area containing the point, or None if it's outside Denver.

        Boundary rule: a point exactly on the line between two neighborhoods
        is "covered" by both. We check areas in ID order and return the first
        one, so the answer is always the same (lowest ID wins).
        """
        # Shapely uses (x, y) = (longitude, latitude). Easy to mix up!
        point = Point(lon, lat)
        for area, fast_check in self._fast_checks:
            if fast_check.covers(point):
                return area
        return None

    def by_name(self, name):
        for area in self.areas:
            if area.name == name:
                return area
        return None


def _first_property(properties, names):
    for name in names:
        if properties.get(name) not in (None, ""):
            return properties[name]
    return None


def load_boundaries(path):
    """Read a GeoJSON file into a Boundaries object. Raises NeighborhoodDataError."""
    path = Path(path)
    if not path.exists():
        raise NeighborhoodDataError(
            f"Neighborhood file not found: {path}. See backend/data/SOURCE.md for how to download it."
        )
    raw = path.read_bytes()
    data = json.loads(raw)
    features = data.get("features") or []
    if not features:
        raise NeighborhoodDataError(f"No features found in {path}.")

    areas = []
    for index, feature in enumerate(features):
        properties = feature.get("properties") or {}
        name = _first_property(properties, NAME_FIELDS)
        if not name:
            raise NeighborhoodDataError(f"Feature #{index} has no neighborhood name.")
        raw_id = _first_property(properties, ID_FIELDS)
        if raw_id is None:
            raise NeighborhoodDataError(f"Feature '{name}' has no neighborhood ID.")
        areas.append(Area(id=int(raw_id), name=str(name).strip(), geometry=shape(feature["geometry"])))

    version = hashlib.sha256(raw).hexdigest()[:12]
    return Boundaries(areas=areas, source_version=version)


@lru_cache(maxsize=1)
def get_boundaries():
    """The Denver boundaries, loaded once per server process."""
    return load_boundaries(settings.NEIGHBORHOODS_GEOJSON)
