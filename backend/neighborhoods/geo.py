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
from shapely import make_valid, prepared, unary_union
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

    def __init__(self, areas, source_version, repaired=()):
        # Sorted by ID so the boundary rule below is deterministic.
        self.areas = sorted(areas, key=lambda a: a.id)
        # Names of neighborhoods whose shape needed repairing (see repair_shape).
        self.repaired = list(repaired)
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


def repair_shape(geometry):
    """
    Return a valid version of the shape, covering exactly the same ground.

    The city's file isn't perfect: in 2026, Virginia Village has a small hole
    (a patch that isn't part of any Denver neighborhood) stored as a separate
    piece instead of as a hole in its main shape. That breaks the geometry
    rules and can make point checks unreliable. make_valid reads a piece
    inside another piece as a hole, which is what the city meant: the file
    draws outlines clockwise and holes counter-clockwise, and this piece is
    counter-clockwise. We never edit the city's file; we fix the shape in
    memory when loading it.
    """
    if geometry.is_valid:
        return geometry
    fixed = make_valid(geometry)
    if fixed.geom_type == "GeometryCollection":
        # Keep only the area parts; drop any stray lines or points.
        fixed = unary_union([g for g in fixed.geoms if g.geom_type in ("Polygon", "MultiPolygon")])
    return fixed


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
    repaired = []
    for index, feature in enumerate(features):
        properties = feature.get("properties") or {}
        name = _first_property(properties, NAME_FIELDS)
        if not name:
            raise NeighborhoodDataError(f"Feature #{index} has no neighborhood name.")
        raw_id = _first_property(properties, ID_FIELDS)
        if raw_id is None:
            raise NeighborhoodDataError(f"Feature '{name}' has no neighborhood ID.")
        name = str(name).strip()
        geometry = shape(feature["geometry"])
        if not geometry.is_valid:
            geometry = repair_shape(geometry)
            repaired.append(name)
        areas.append(Area(id=int(raw_id), name=name, geometry=geometry))

    version = hashlib.sha256(raw).hexdigest()[:12]
    return Boundaries(areas=areas, source_version=version, repaired=repaired)


@lru_cache(maxsize=1)
def get_boundaries():
    """The Denver boundaries, loaded once per server process."""
    return load_boundaries(settings.NEIGHBORHOODS_GEOJSON)
