"""Being told when something breaks (review O8, PLAN P14)."""

from datetime import timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from notifications.models import JobRun
from stats.numbers import job_numbers

LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


class JobHeartbeatTests(TestCase):
    def test_the_reminders_job_records_each_good_run(self):
        self.assertTrue(job_numbers(timezone.now())["late"])  # never ran
        call_command("send_due_notifications", stdout=mock.MagicMock())
        self.assertFalse(job_numbers(timezone.now())["late"])
        self.assertTrue(job_numbers(timezone.now() + timedelta(hours=2))["late"])

    def test_the_owner_stats_page_warns_when_it_is_late(self):
        staff = get_user_model().objects.create_superuser(username="team@example.com", password="x")
        self.client.force_login(staff)
        page = self.client.get("/admin/stats/")
        self.assertContains(page, "Reminders may not be going out")
        JobRun.record_ok("send_due_notifications")
        self.assertNotContains(self.client.get("/admin/stats/"), "Reminders may not be going out")


@override_settings(SERVER_ERROR_EMAILS=["team@example.com"], CACHES=LOCMEM)
class ServerErrorEmailTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient(raise_request_exception=False)

    def crash(self):
        # The traceback still goes to the console log, as usual; quiet it here.
        with mock.patch("logging.StreamHandler.emit"), mock.patch("config.views.config_json", side_effect=RuntimeError("1234 Secret St")):
            return self.client.get("/api/config?q=private")

    def test_a_crash_sends_a_short_email_without_any_data(self):
        # (Not inside assertLogs: that would swap out the email handler.)
        self.assertEqual(self.crash().status_code, 500)
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.to, ["team@example.com"])
        self.assertIn("RuntimeError on GET /api/config", message.subject)
        self.assertNotIn("Secret St", message.body + message.subject)  # not the error's message
        self.assertNotIn("private", message.body + message.subject)  # not the query string

    def test_the_same_crash_emails_once_every_ten_minutes(self):
        self.crash()
        self.crash()
        self.assertEqual(len(mail.outbox), 1)
