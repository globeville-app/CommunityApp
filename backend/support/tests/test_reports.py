"""Report a problem: saving, limits, screenshots, admin and the team email."""

import shutil
import tempfile

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from PIL import Image
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from profiles.testing import exif_with_gps, image_bytes, upload
from support.models import ProblemReport

PRIVATE = tempfile.mkdtemp(prefix="test-private-")
TEAM = ["first@example.org", "second@example.org"]
DETAILS = {
    "app_version": "1.0.0 (12)",
    "os": "iOS 19.1",
    "device_model": "iPhone 16",
    "language": "es",
    "screen": "join/address",
}


@override_settings(PRIVATE_MEDIA_ROOT=PRIVATE, PROBLEM_REPORT_EMAILS=TEAM)
class ProblemReportTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(PRIVATE, ignore_errors=True)
        super().tearDownClass()

    def report(self, **fields):
        body = {"message": "The map button does nothing.", **DETAILS, **fields}
        return self.client.post("/api/support/report", body, format="multipart")

    def sign_in(self):
        user = get_user_model().objects.create_user(username="ana@example.com", email="ana@example.com", password="x")
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {Token.objects.create(user=user).key}")
        return user

    def test_signed_in_report_is_saved_with_the_user(self):
        user = self.sign_in()
        response = self.report(contact_email="ignored@example.com")
        self.assertEqual(response.status_code, 201)
        report = ProblemReport.objects.get()
        self.assertEqual(report.user, user)
        self.assertEqual(report.contact_email, "")  # members don't need one
        self.assertEqual(report.status, "new")
        self.assertEqual(
            {k: getattr(report, k) for k in DETAILS},
            DETAILS,
        )

    def test_signed_out_report_keeps_the_optional_email(self):
        self.assertEqual(self.report(contact_email="neighbor@example.com").status_code, 201)
        report = ProblemReport.objects.get()
        self.assertIsNone(report.user)
        self.assertEqual(report.contact_email, "neighbor@example.com")

    def test_signed_out_report_without_email_is_fine(self):
        self.assertEqual(self.report().status_code, 201)

    def test_rejected_reports(self):
        cases = [
            ({"message": "   "}, "message_required"),
            ({"message": "x" * 1001}, "message_too_long"),
            ({"screenshot": upload(b"not an image", name="notes.jpg")}, "bad_image"),
            ({"screenshot": upload(image_bytes(fmt="GIF"), name="a.gif", content_type="image/gif")}, "bad_image"),
            ({"contact_email": "not-an-email"}, "invalid_email"),
        ]
        for fields, code in cases:
            with self.subTest(code=code):
                response = self.report(**fields)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.data, {"code": code})
        self.assertFalse(ProblemReport.objects.exists())

    def test_a_message_of_exactly_1000_characters_is_fine(self):
        self.assertEqual(self.report(message="x" * 1000).status_code, 201)

    @override_settings(PHOTO_MAX_BYTES=1000)
    def test_screenshot_over_the_size_limit_is_rejected(self):
        response = self.report(screenshot=upload(image_bytes(size=(400, 400))))
        self.assertEqual(response.data, {"code": "bad_image"})

    def test_screenshot_exif_is_stripped_and_never_returned(self):
        response = self.report(screenshot=upload(image_bytes(exif=exif_with_gps())))
        self.assertEqual(response.status_code, 201)
        # Only a reference number comes back: no file, no link.
        self.assertEqual(set(response.data), {"id"})

        report = ProblemReport.objects.get()
        with report.screenshot.open("rb") as f:
            saved = Image.open(f)
            self.assertEqual(dict(saved.getexif()), {})
        # It's stored outside the public media folder, so /media/ can't serve it.
        self.assertTrue(report.screenshot.path.startswith(PRIVATE))
        self.assertEqual(self.client.get(f"/media/{report.screenshot.name}").status_code, 404)

    def test_only_staff_can_see_screenshots_in_the_admin(self):
        self.report(screenshot=upload(image_bytes()))
        report = ProblemReport.objects.get()
        url = f"/admin/support/problemreport/{report.pk}/screenshot/"

        member = get_user_model().objects.create_user(username="m@example.com", password="x")
        self.client.force_login(member)
        self.assertNotEqual(self.client.get(url).status_code, 200)

        staff = get_user_model().objects.create_superuser(username="s@example.com", password="x")
        self.client.force_login(staff)
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "image/jpeg")
        page = self.client.get(f"/admin/support/problemreport/{report.pk}/change/")
        self.assertContains(page, url)

    def test_admin_lists_and_filters_reports(self):
        self.report()
        self.report(language="en", app_version="1.0.1 (13)")
        staff = get_user_model().objects.create_superuser(username="s@example.com", password="x")
        self.client.force_login(staff)
        self.assertEqual(self.client.get("/admin/support/problemreport/").status_code, 200)
        filtered = self.client.get("/admin/support/problemreport/?status__exact=new&language__exact=es")
        self.assertEqual(filtered.context["cl"].result_count, 1)

    def test_team_email_goes_to_everyone_without_the_screenshot(self):
        long_message = "Step one. " * 40
        self.report(message=long_message, screenshot=upload(image_bytes()))
        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertEqual(email.to, TEAM)
        self.assertEqual(email.attachments, [])
        self.assertIn(long_message.strip()[:200], email.body)
        self.assertNotIn(long_message.strip(), email.body)  # only the first 200 characters
        for value in DETAILS.values():
            self.assertIn(value, email.body)
        report = ProblemReport.objects.get()
        self.assertIn(f"/admin/support/problemreport/{report.pk}/change/", email.body)

    @override_settings(PROBLEM_REPORT_EMAILS=[])
    def test_no_email_when_nobody_is_configured(self):
        self.assertEqual(self.report().status_code, 201)
        self.assertEqual(mail.outbox, [])


@override_settings(
    PRIVATE_MEDIA_ROOT=PRIVATE,
    PROBLEM_REPORT_EMAILS=[],
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}},
)
class DailyLimitTests(APITestCase):
    def setUp(self):
        cache.clear()

    def send(self):
        return self.client.post("/api/support/report", {"message": "Help"}, format="multipart")

    def test_members_can_send_five_a_day(self):
        user = get_user_model().objects.create_user(username="ana@example.com", password="x")
        self.client.force_authenticate(user)
        codes = [self.send().status_code for _ in range(6)]
        self.assertEqual(codes, [201] * 5 + [429])
        self.assertEqual(self.send().data, {"code": "daily_limit"})
        self.assertEqual(ProblemReport.objects.count(), 5)

    def test_signed_out_reports_are_limited_by_ip_address(self):
        codes = [self.send().status_code for _ in range(6)]
        self.assertEqual(codes, [201] * 5 + [429])
        # Another address still gets through.
        other = self.client.post(
            "/api/support/report", {"message": "Help"}, format="multipart", REMOTE_ADDR="10.0.0.99"
        )
        self.assertEqual(other.status_code, 201)
