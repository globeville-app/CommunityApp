import io
import shutil
import tempfile
from pathlib import Path
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import override_settings
from PIL import ExifTags, Image
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from geocoding.testing import census_reply, fake_geocoder
from neighborhoods.testing import FixtureNeighborhoodsMixin
from profiles.models import Profile
from profiles.testing import exif_with_gps, image_bytes, upload

TEMP_MEDIA = tempfile.mkdtemp(prefix="test-media-")


@override_settings(MEDIA_ROOT=TEMP_MEDIA)
class ProfileTestCase(FixtureNeighborhoodsMixin, APITestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(TEMP_MEDIA, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        super().setUp()
        self.user = get_user_model().objects.create_user(username="ana@example.com", password="x")
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    def match(self, point):
        with fake_geocoder(census_reply(*point)):
            return self.client.post("/api/join/match", {"address": "1 Main St"}, format="json")

    def save_profile(self, **overrides):
        body = {"first_name": "Ana", "last_name": "rivera", **overrides}
        return self.client.put("/api/profile", body, format="json")


class ProfileApiTests(ProfileTestCase):
    def test_profile_needs_a_match_first(self):
        response = self.save_profile()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "match_required")

    def test_create_profile_uses_the_matched_neighborhood(self):
        self.match(self.HIGHLAND)
        response = self.save_profile(alias="LoHi", interests=["block_party", "gardening"])
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["display_name"], "Ana R.")
        self.assertEqual(
            response.data["neighborhood"],
            {"id": 3, "name": "Highland", "center": {"latitude": 39.85, "longitude": -104.95}},
        )
        self.assertEqual(response.data["alias"], "LoHi")
        # Saved as sent (keys only; the app shows the words).
        self.assertEqual(response.data["interests"], ["block_party", "gardening"])
        self.assertEqual(response.data["role"], "member")
        self.assertIsNone(response.data["photo_url"])

    def test_only_the_last_initial_is_stored(self):
        self.match(self.EAST)
        self.save_profile(last_name="Rivera-Smith")
        profile = Profile.objects.get()
        self.assertEqual(profile.last_initial, "R")
        self.assertNotIn("Rivera", str(Profile.objects.values().get()))

    def test_app_cannot_choose_its_own_neighborhood(self):
        self.match(self.EAST)  # id 1
        self.save_profile(neighborhood_id=3, neighborhood=3)
        self.assertEqual(Profile.objects.get().neighborhood_id, 1)

    def test_alias_must_belong_to_the_neighborhood(self):
        self.match(self.EAST)
        response = self.save_profile(alias="LoHi")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "invalid_alias")

    def test_unknown_interest_is_rejected(self):
        self.match(self.EAST)
        response = self.save_profile(interests=["Skydiving"])
        self.assertEqual(response.status_code, 400)
        self.assertIn("interests", response.data["fields"])

    def test_first_and_last_name_are_required(self):
        self.match(self.EAST)
        response = self.client.put("/api/profile", {"first_name": ""}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("first_name", response.data["fields"])
        self.assertIn("last_name", response.data["fields"])

    def test_saving_again_updates(self):
        self.match(self.EAST)
        self.save_profile()
        response = self.save_profile(first_name="Anita")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Profile.objects.get().first_name, "Anita")

    def test_me_before_joining_is_profile_not_found(self):
        response = self.client.get("/api/profile/me")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data["code"], "profile_not_found")

    def test_me_returns_the_profile(self):
        self.match(self.HIGHLAND)
        self.save_profile(alias="LoHi")
        response = self.client.get("/api/profile/me")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["display_name"], "Ana R.")
        self.assertEqual(response.data["alias"], "LoHi")

    def test_endpoints_reject_missing_token(self):
        self.client.credentials()
        self.assertEqual(self.save_profile().status_code, 401)
        self.assertEqual(self.client.get("/api/profile/me").status_code, 401)
        self.assertEqual(self.client.post("/api/profile/photo").status_code, 401)


class PhotoTests(ProfileTestCase):
    def setUp(self):
        super().setUp()
        self.match(self.EAST)
        self.save_profile()

    def post_photo(self, file):
        return self.client.post("/api/profile/photo", {"photo": file}, format="multipart")

    def stored_image(self):
        path = Path(Profile.objects.get().photo.path)
        return path, Image.open(io.BytesIO(path.read_bytes()))

    def test_jpeg_upload_strips_exif_including_gps(self):
        response = self.post_photo(upload(image_bytes("JPEG", exif=exif_with_gps()), name="ana_home.jpg"))
        self.assertEqual(response.status_code, 200)
        path, image = self.stored_image()
        self.assertEqual(image.format, "JPEG")
        self.assertEqual(len(image.getexif()), 0)
        self.assertNotIn("exif", image.info)
        self.assertNotIn(b"TestPhone", path.read_bytes())
        self.assertTrue(response.data["photo_url"].endswith(path.name))

    def test_png_upload_strips_exif(self):
        response = self.post_photo(
            upload(image_bytes("PNG", exif=exif_with_gps()), name="a.png", content_type="image/png")
        )
        self.assertEqual(response.status_code, 200)
        path, image = self.stored_image()
        self.assertEqual(image.format, "PNG")
        self.assertEqual(len(image.getexif()), 0)
        self.assertNotIn(b"TestPhone", path.read_bytes())

    def test_sideways_phone_photo_is_rotated_upright(self):
        # Orientation 6 = "rotate 90° to view". A 40x20 image should become 20x40.
        self.post_photo(upload(image_bytes("JPEG", size=(40, 20), exif=exif_with_gps(orientation=6))))
        _, image = self.stored_image()
        self.assertEqual(image.size, (20, 40))

    def test_filename_is_random(self):
        self.post_photo(upload(image_bytes(), name="ana_rivera_at_home.jpg"))
        path, _ = self.stored_image()
        self.assertNotIn("ana", path.name)
        self.assertRegex(path.name, r"^[0-9a-f]{32}\.jpg$")

    def test_wrong_type_is_rejected(self):
        gif = image_bytes("GIF")
        response = self.post_photo(upload(gif, name="a.gif", content_type="image/gif"))
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "photo_wrong_type")

    def test_not_an_image_is_rejected(self):
        response = self.post_photo(upload(b"%PDF-1.4 not a photo", name="a.jpg"))
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "photo_wrong_type")

    def test_renamed_file_is_judged_by_its_contents(self):
        response = self.post_photo(upload(image_bytes("GIF"), name="sneaky.jpg"))
        self.assertEqual(response.data["code"], "photo_wrong_type")

    def test_oversized_is_rejected(self):
        too_big = image_bytes() + b"\0" * (5 * 1024 * 1024)
        response = self.post_photo(upload(too_big))
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "photo_too_large")
        self.assertFalse(Profile.objects.get().photo)

    def test_tiny_file_with_a_huge_picture_is_rejected(self):
        # 13,000 x 13,000 black-and-white pixels compress to a few KB, but
        # would need hundreds of MB to open (review/06-skeptic.md, N1).
        output = io.BytesIO()
        Image.new("1", (13000, 13000)).save(output, format="PNG")
        self.assertLess(len(output.getvalue()), 100_000)
        response = self.post_photo(upload(output.getvalue(), name="a.png", content_type="image/png"))
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "photo_wrong_type")
        self.assertFalse(Profile.objects.get().photo)

    def test_jpeg_over_the_pixel_limit_is_rejected(self):
        with mock.patch.dict("profiles.photos.MAX_PIXELS", {"JPEG": 40 * 20 - 1}):
            response = self.post_photo(upload(image_bytes("JPEG", size=(40, 20))))
        self.assertEqual(response.data["code"], "photo_wrong_type")

    def test_large_jpeg_is_shrunk_to_the_maximum_side(self):
        response = self.post_photo(upload(image_bytes("JPEG", size=(4100, 3000))))
        self.assertEqual(response.status_code, 200)
        _, image = self.stored_image()
        self.assertEqual(max(image.size), 2048)

    def test_replacing_a_photo_deletes_the_old_file(self):
        self.post_photo(upload(image_bytes()))
        old_path, _ = self.stored_image()
        self.post_photo(upload(image_bytes(color=(0, 0, 255))))
        new_path, _ = self.stored_image()
        self.assertNotEqual(old_path, new_path)
        self.assertFalse(old_path.exists())

    def test_upload_logs_size_and_time_only(self):
        with self.assertLogs("profiles.views", level="INFO") as logs:
            self.post_photo(upload(image_bytes("JPEG", exif=exif_with_gps())))
        self.assertRegex(logs.output[0], r"Profile photo received: [0-9.]+ MB, cleaned in [0-9.]+ s")
        self.assertNotIn("TestPhone", logs.output[0])

    def test_missing_photo_field(self):
        response = self.client.post("/api/profile/photo", {}, format="multipart")
        self.assertEqual(response.data["code"], "photo_missing")
