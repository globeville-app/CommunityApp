"""
Checks against the real Denver file. These are skipped (with a reason
printed) until backend/data/denver_statistical_neighborhoods.geojson exists.
"""

import json
from itertools import combinations
from pathlib import Path
from unittest import skipIf

from django.conf import settings
from django.test import SimpleTestCase
from shapely import unary_union
from shapely.geometry import Polygon

from neighborhoods.aliases import get_alias_map
from neighborhoods.geo import get_boundaries
from neighborhoods.testing import REAL_DATA_MISSING, REAL_DATA_SKIP_REASON, clear_caches


@skipIf(REAL_DATA_MISSING, REAL_DATA_SKIP_REASON)
class DenverDataTests(SimpleTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        clear_caches()
        cls.boundaries = get_boundaries()

    def test_there_are_78_neighborhoods(self):
        self.assertEqual(len(self.boundaries.areas), 78)

    def test_every_neighborhood_has_a_name_and_unique_id(self):
        names = [a.name for a in self.boundaries.areas]
        ids = [a.id for a in self.boundaries.areas]
        self.assertTrue(all(names))
        self.assertEqual(len(set(ids)), 78)
        self.assertEqual(len(set(names)), 78)

    def test_every_shape_is_a_valid_polygon(self):
        for area in self.boundaries.areas:
            with self.subTest(area.name):
                self.assertIn(area.geometry.geom_type, ("Polygon", "MultiPolygon"))
                self.assertTrue(area.geometry.is_valid)
                self.assertFalse(area.geometry.is_empty)

    def test_repairs_follow_the_citys_outline_and_hole_drawing(self):
        # In this file, outlines are drawn clockwise and holes counter-clockwise.
        # A repaired shape must equal: clockwise pieces minus counter-clockwise ones.
        raw = {
            f["properties"]["NBHD_NAME"].strip(): f["geometry"]
            for f in json.loads(Path(settings.NEIGHBORHOODS_GEOJSON).read_text())["features"]
        }
        for name in self.boundaries.repaired:
            geometry = raw[name]
            polys = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
            rings = [Polygon(ring) for poly in polys for ring in poly]
            outlines = unary_union([r for r in rings if not r.exterior.is_ccw])
            holes = unary_union([r for r in rings if r.exterior.is_ccw])
            expected = outlines.difference(holes)
            fixed = self.boundaries.by_name(name).geometry
            with self.subTest(name):
                self.assertTrue(fixed.is_valid)
                self.assertLess(fixed.symmetric_difference(expected).area, 1e-12)

    def test_virginia_village_island_and_hole(self):
        # The city's note: "Includes +/- 9.6 acre island per 2020 census tract".
        self.assertEqual(self.boundaries.find(39.6990, -104.9330).name, "Virginia Village")  # island
        self.assertEqual(self.boundaries.find(39.6828, -104.9265).name, "Virginia Village")  # main
        self.assertIsNone(self.boundaries.find(39.68117, -104.90956))  # the hole

    def test_coordinates_are_latitude_longitude_around_denver(self):
        # Catches a file downloaded in the wrong coordinate system (EPSG:4326 needed).
        for area in self.boundaries.areas:
            min_lon, min_lat, max_lon, max_lat = area.geometry.bounds
            with self.subTest(area.name):
                self.assertTrue(-105.2 < min_lon and max_lon < -104.5)
                self.assertTrue(39.5 < min_lat and max_lat < 40.0)

    def test_known_points_land_in_their_own_neighborhood(self):
        # Five neighborhoods spread through the list. For each one we take a
        # point well inside it (shrunk away from the edges), straight from the data.
        areas = self.boundaries.areas
        picks = [areas[i] for i in (0, len(areas) // 4, len(areas) // 2, 3 * len(areas) // 4, -1)]
        for area in picks:
            inner = area.geometry.buffer(-0.001)
            point = (inner if not inner.is_empty else area.geometry).representative_point()
            with self.subTest(area.name):
                self.assertEqual(self.boundaries.find(point.y, point.x).id, area.id)

    def test_points_outside_denver(self):
        outside = {
            "Lakewood civic center": (39.7095, -105.0845),
            "Aurora (Anschutz campus)": (39.7452, -104.8378),
            "Colorado Springs": (38.8339, -104.8214),
            "Golden": (39.7555, -105.2211),
        }
        for place, (lat, lon) in outside.items():
            with self.subTest(place):
                self.assertIsNone(self.boundaries.find(lat, lon))

    def test_shared_boundary_point_is_deterministic(self):
        # Find a corner point that two neighborhoods share exactly.
        for a, b in combinations(self.boundaries.areas, 2):
            shared = _vertices(a.geometry) & _vertices(b.geometry)
            if shared:
                lon, lat = sorted(shared)[0]
                break
        else:
            self.fail("No shared corner found between any two neighborhoods.")
        expected = min(a.id, b.id)
        results = {self.boundaries.find(lat, lon).id for _ in range(5)}
        self.assertEqual(len(results), 1)
        # The lowest ID that covers the point wins (could be a third area at a corner).
        self.assertLessEqual(results.pop(), expected)

    def test_every_alias_points_at_a_real_neighborhood(self):
        names = {a.name for a in self.boundaries.areas}
        for alias, targets in get_alias_map().items():
            for target in targets:
                with self.subTest(alias=alias, target=target):
                    self.assertIn(target, names)

    def test_lohi_is_highland(self):
        self.assertIsNotNone(self.boundaries.by_name("Highland"))
        self.assertIn("Highland", get_alias_map()["LoHi"])


def _vertices(geometry):
    polygons = geometry.geoms if geometry.geom_type == "MultiPolygon" else [geometry]
    return {coord for polygon in polygons for coord in polygon.exterior.coords}
