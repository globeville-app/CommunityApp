"""Organization paths the first tests didn't cover (review 04-tests.md, PLAN P21)."""

import shutil
import tempfile
from unittest import mock

import httpx
from django.contrib.auth import get_user_model
from django.test import override_settings

from notifications.push import PushUnavailable, post_to_expo
from organizations.models import Organization, OrganizationChangeRequest
from organizations.tests.helpers import OrgTestCase
from profiles.models import Profile
from profiles.testing import exif_with_gps, image_bytes, upload

MEDIA = tempfile.mkdtemp(prefix="test-org-media-")


class ChangeRequestAdminTests(OrgTestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.org()
        staff = get_user_model().objects.create_superuser(username="team@example.com", password="x")
        self.client.force_login(staff)

    def act(self, action, change):
        return self.client.post(
            "/admin/organizations/organizationchangerequest/",
            {"action": action, "_selected_action": [change.pk]},
        )

    def test_approve_applies_the_new_name_and_neighborhoods(self):
        change = OrganizationChangeRequest.objects.create(
            organization=self.organization, name="Our Lady of Grace", neighborhood_ids=[self.highland.pk]
        )
        self.act("approve", change)
        self.organization.refresh_from_db()
        change.refresh_from_db()
        self.assertEqual(self.organization.name, "Our Lady of Grace")
        self.assertEqual(list(self.organization.neighborhoods.all()), [self.highland])
        self.assertEqual(change.status, "approved")

    def test_reject_needs_a_reason(self):
        change = OrganizationChangeRequest.objects.create(organization=self.organization, name="Bad name")
        self.act("reject", change)
        change.refresh_from_db()
        self.assertEqual(change.status, "pending")
        OrganizationChangeRequest.objects.filter(pk=change.pk).update(rejection_reason="Not its real name")
        self.act("reject", change)
        change.refresh_from_db()
        self.organization.refresh_from_db()
        self.assertEqual(change.status, "rejected")
        self.assertEqual(self.organization.name, "Our Lady Church")


class AdminsAndPageTests(OrgTestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(MEDIA, ignore_errors=True)
        super().tearDownClass()

    def test_an_admin_can_remove_another(self):
        organization = self.org(admins=[self.admin_user, self.ana])
        ana_id = Profile.objects.get(user=self.ana).pk
        response = self.api(self.admin_user).delete(
            f"/api/organizations/{organization.pk}/admins", {"member_id": ana_id}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual([a["display_name"] for a in response.data["admins"]], ["Rosa R."])
        self.assertFalse(organization.is_admin(self.ana))

    @override_settings(MEDIA_ROOT=MEDIA)
    def test_photo_upload_strips_location_data(self):
        organization = self.org()
        response = self.api(self.admin_user).post(
            f"/api/organizations/{organization.pk}/photo",
            {"photo": upload(image_bytes(exif=exif_with_gps()))},
            format="multipart",
        )
        self.assertEqual(response.status_code, 200)
        organization.refresh_from_db()
        with organization.photo.open("rb") as f:
            self.assertNotIn(b"TestPhone", f.read())
        # Only admins may change it.
        other = self.api(self.ana).post(
            f"/api/organizations/{organization.pk}/photo", {"photo": upload(image_bytes())}, format="multipart"
        )
        self.assertEqual(other.status_code, 403)

    @override_settings(TRANSLATOR_CLASS="events.testing.FakeTranslator")
    def test_description_translation_prefers_the_admins_own_words_then_caches(self):
        organization = self.org()
        client = self.api(self.ana)
        url = f"/api/organizations/{organization.pk}/translate"
        machine = client.post(url, {"target": "es"}, format="json").data
        self.assertEqual(machine, {"description": "[en->es] Every Sunday.", "target": "es", "machine": True})
        self.assertEqual(client.post(url, {"target": "es"}, format="json").data, machine)  # from the cache
        Organization.objects.filter(pk=organization.pk).update(description_alt="Cada domingo.")
        own = client.post(url, {"target": "es"}, format="json").data
        self.assertEqual(own, {"description": "Cada domingo.", "target": "es", "machine": False})


class ExpoErrorTests(OrgTestCase):
    def test_expo_errors_become_push_unavailable_and_log_only_the_kind(self):
        for failure in (httpx.ConnectTimeout("slow"), httpx.HTTPStatusError("500", request=None, response=None)):
            with self.subTest(failure=type(failure).__name__), mock.patch("httpx.post", side_effect=failure):
                with self.assertLogs("notifications.push", level="WARNING") as logs, self.assertRaises(PushUnavailable):
                    post_to_expo([{"to": "ExponentPushToken[secret]", "body": "Tomorrow 10:00 AM"}])
                self.assertNotIn("secret", logs.output[0])
                self.assertNotIn("Tomorrow", logs.output[0])
