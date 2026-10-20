"""Deleting an account removes the member's data and keeps their bug reports anonymously."""

import os
import shutil
import tempfile

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from accounts.models import Account
from geocoding.testing import census_reply, fake_geocoder
from neighborhoods.models import NeighborhoodMatch
from neighborhoods.testing import FixtureNeighborhoodsMixin
from profiles.models import Profile
from profiles.testing import image_bytes, upload
from support.models import ProblemReport
from accounts.testing import confirm_email

MEDIA = tempfile.mkdtemp(prefix="test-media-")
PRIVATE = tempfile.mkdtemp(prefix="test-private-")
PASSWORD = "a long pass phrase"


@override_settings(MEDIA_ROOT=MEDIA, PRIVATE_MEDIA_ROOT=PRIVATE, PROBLEM_REPORT_EMAILS=[])
class DeleteAccountTests(FixtureNeighborhoodsMixin, APITestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(MEDIA, ignore_errors=True)
        shutil.rmtree(PRIVATE, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        super().setUp()
        signup = {"email": "ana@example.com", "password": PASSWORD, "language": "es"}
        self.token = self.client.post("/api/auth/signup", signup, format="json").data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token}")
        confirm_email(self.client)
        with fake_geocoder(census_reply(*self.HIGHLAND)):
            self.client.post("/api/join/match", {"address": "1 Main St"}, format="json")
        profile = {"first_name": "Ana", "last_name": "R", "interests": ["gardening"]}
        self.client.put("/api/profile", profile, format="json")
        self.client.post("/api/profile/photo", {"photo": upload(image_bytes())}, format="multipart")
        self.client.post("/api/support/report", {"message": "Map is slow"}, format="multipart")
        # A report from before signing in, with a contact email, linked for the test.
        ProblemReport.objects.create(
            user=get_user_model().objects.get(), contact_email="ana@example.com", message="Can't join"
        )
        self.photo_path = Profile.objects.get().photo.path

    def delete(self, password):
        return self.client.post("/api/account/delete", {"password": password}, format="json")

    def test_wrong_password_is_rejected(self):
        response = self.delete("not my password")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data, {"code": "wrong_password"})
        self.assertTrue(get_user_model().objects.exists())
        self.assertTrue(os.path.exists(self.photo_path))

    def test_password_is_required(self):
        self.assertEqual(self.client.post("/api/account/delete", {}, format="json").data["code"], "invalid_password")

    def test_requires_a_login(self):
        self.client.credentials()
        self.assertEqual(self.delete(PASSWORD).status_code, 401)

    def test_deletes_the_user_profile_photo_and_tokens(self):
        self.assertTrue(os.path.exists(self.photo_path))
        response = self.delete(PASSWORD)
        self.assertEqual(response.status_code, 204)
        self.assertFalse(get_user_model().objects.exists())
        self.assertFalse(Profile.objects.exists())
        self.assertFalse(Account.objects.exists())
        self.assertFalse(NeighborhoodMatch.objects.exists())
        self.assertFalse(Token.objects.exists())
        self.assertFalse(os.path.exists(self.photo_path))
        # The old token is dead.
        self.assertEqual(self.client.get("/api/profile/me").status_code, 401)

    def test_problem_reports_stay_without_the_person(self):
        self.delete(PASSWORD)
        reports = ProblemReport.objects.order_by("id")
        self.assertEqual([r.message for r in reports], ["Map is slow", "Can't join"])
        self.assertTrue(all(r.user is None for r in reports))
        self.assertTrue(all(r.contact_email == "" for r in reports))

    def test_the_email_can_sign_up_again(self):
        self.delete(PASSWORD)
        self.client.credentials()
        login = self.client.post("/api/auth/login", {"email": "ana@example.com", "password": PASSWORD}, format="json")
        self.assertEqual(login.data, {"code": "invalid_credentials"})
        again = self.client.post("/api/auth/signup", {"email": "ana@example.com", "password": PASSWORD}, format="json")
        self.assertEqual(again.status_code, 201)
        # A brand-new account: nothing carried over.
        self.assertEqual(again.data["language"], "en")
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {again.data['token']}")
        confirm_email(self.client)
        self.assertEqual(self.client.get("/api/profile/me").data, {"code": "profile_not_found"})
