"""Point-in-polygon logic, checked against three made-up squares."""

from django.test import SimpleTestCase, TestCase

from neighborhoods.aliases import aliases_for, load_aliases
from neighborhoods.geo import NeighborhoodDataError, load_boundaries
from neighborhoods.models import Neighborhood
from neighborhoods.testing import FIXTURE_GEOJSON, FixtureNeighborhoodsMixin


class FindNeighborhoodTests(SimpleTestCase):
    def setUp(self):
        self.boundaries = load_boundaries(FIXTURE_GEOJSON)

    def test_areas_are_sorted_by_id(self):
        self.assertEqual([a.id for a in self.boundaries.areas], [1, 2, 3])

    def test_points_inside_land_in_the_right_area(self):
        self.assertEqual(self.boundaries.find(39.75, -104.85).name, "East Square")
        self.assertEqual(self.boundaries.find(39.75, -104.95).name, "West Square")
        self.assertEqual(self.boundaries.find(39.85, -104.95).name, "Highland")

    def test_point_outside_returns_none(self):
        self.assertIsNone(self.boundaries.find(38.83, -104.82))

    def test_point_on_shared_edge_goes_to_lowest_id(self):
        # Longitude -104.9 is the edge between West (id 2) and East (id 1).
        for _ in range(5):  # same answer every time
            self.assertEqual(self.boundaries.find(39.75, -104.9).id, 1)

    def test_point_on_corner_of_three_areas_goes_to_lowest_id(self):
        self.assertEqual(self.boundaries.find(39.8, -104.9).id, 1)

    def test_edge_between_two_and_three_goes_to_two(self):
        self.assertEqual(self.boundaries.find(39.8, -104.95).id, 2)

    def test_missing_file_gives_a_helpful_error(self):
        with self.assertRaisesMessage(NeighborhoodDataError, "SOURCE.md"):
            load_boundaries("/no/such/file.geojson")


class AliasTests(SimpleTestCase):
    def test_lohi_points_to_highland(self):
        from django.conf import settings

        alias_map = load_aliases(settings.NEIGHBORHOOD_ALIASES_JSON)
        self.assertEqual(alias_map["LoHi"], ["Highland"])
        self.assertEqual(aliases_for("Highland", alias_map), ["LoHi"])

    def test_one_alias_can_cover_several_neighborhoods(self):
        alias_map = {"Uptown": ["North Capitol Hill", "City Park West"], "LoHi": ["Highland"]}
        self.assertEqual(aliases_for("City Park West", alias_map), ["Uptown"])
        self.assertEqual(aliases_for("Highland", alias_map), ["LoHi"])
        self.assertEqual(aliases_for("Hale", alias_map), [])


class LoadCommandTests(FixtureNeighborhoodsMixin, TestCase):
    def test_command_creates_one_row_per_area(self):
        self.assertEqual(
            list(Neighborhood.objects.values_list("id", "name")),
            [(1, "East Square"), (2, "West Square"), (3, "Highland")],
        )
        self.assertEqual(len(Neighborhood.objects.first().source_version), 12)
