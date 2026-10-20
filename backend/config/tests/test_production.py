"""
Production settings (docs/GO_LIVE.md): they refuse to start without real
secrets, pass Django's deployment checks, keep logs free of private data,
and the admin's two-step login works.
"""

import logging
import os
import subprocess
import sys
from pathlib import Path

from django.conf import settings
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.urls import reverse
from django_otp.admin import OTPAdminSite
from django_otp.oath import TOTP
from django_otp.plugins.otp_totp.models import TOTPDevice

from config.tests.test_privacy import ADDRESS, SECRETS, AddressIsNeverStoredTests

BACKEND = Path(__file__).resolve().parents[2]
PRODUCTION_ENV = {
    "DJANGO_DEBUG": "0",
    "DJANGO_SECRET_KEY": "test-only-" + "x" * 60,
    "ALLOWED_HOSTS": "api.example.org",
    "CSRF_TRUSTED_ORIGINS": "https://api.example.org",
    "ADMIN_URL": "team-area/",
}


def run_manage(*args, env=None):
    clean = {k: v for k, v in os.environ.items() if k not in PRODUCTION_ENV}
    return subprocess.run(
        [sys.executable, "manage.py", *args],
        cwd=BACKEND,
        env={**clean, **(env or {})},
        capture_output=True,
        text=True,
        timeout=120,
    )


class ProductionSettingsTests(TestCase):
    def test_refuses_to_start_without_a_secret_key(self):
        env = {**PRODUCTION_ENV}
        del env["DJANGO_SECRET_KEY"]
        result = run_manage("check", env=env)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DJANGO_SECRET_KEY", result.stderr)

    def test_passes_djangos_deployment_check(self):
        result = run_manage("check", "--deploy", "--fail-level", "WARNING", env=PRODUCTION_ENV)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_admin_moves_to_its_secret_path(self):
        code = "from django.urls import reverse; print(reverse('admin:index'))"
        result = run_manage("shell", "-c", code, env=PRODUCTION_ENV)
        self.assertEqual(result.stdout.strip().splitlines()[-1], "/team-area/", result.stderr)


class ProductionLogsTests(AddressIsNeverStoredTests):
    """The privacy flow again, with production's DEBUG=False."""

    @override_settings(DEBUG=False)
    def test_full_flow_leaves_no_trace_of_the_address(self):
        super().test_full_flow_leaves_no_trace_of_the_address()

    @override_settings(DEBUG=False, PROBLEM_REPORT_EMAILS=[])
    def test_problem_report_text_is_not_logged(self):
        with self.assertLogs(level=logging.DEBUG) as logs:
            logging.getLogger("privacy-test").debug("capturing all log output")
            self.client.post("/api/support/report", {"message": f"I live at {ADDRESS}"}, format="multipart")
            self.client.post("/api/support/report", {"message": ""}, format="multipart")  # an error too
        output = "\n".join(logs.output)
        for secret in SECRETS + ["I live at"]:
            self.assertNotIn(secret, output)


class TwoStepAdminTests(TestCase):
    def setUp(self):
        self.original = admin.site.__class__
        admin.site.__class__ = OTPAdminSite  # what production does
        self.staff = get_user_model().objects.create_superuser(username="owner", password="a long pass phrase")

    def tearDown(self):
        admin.site.__class__ = self.original

    def test_a_password_alone_is_not_enough(self):
        self.client.force_login(self.staff)  # signed in, but no code given
        self.assertEqual(self.client.get(reverse("owner-stats")).status_code, 302)
        self.assertEqual(self.client.get(reverse("admin:index")).status_code, 302)

    def test_password_plus_authenticator_code_works(self):
        call_command("add_admin_2fa", "owner", stdout=open(os.devnull, "w"))
        device = TOTPDevice.objects.get(user=self.staff)
        code = TOTP(device.bin_key, device.step, device.t0, device.digits, device.drift).token()
        response = self.client.post(
            reverse("admin:login"),
            {"username": "owner", "password": "a long pass phrase", "otp_device": device.persistent_id, "otp_token": f"{code:06d}"},
        )
        self.assertEqual(response.status_code, 302, response.content[:500])
        self.assertEqual(self.client.get(reverse("owner-stats")).status_code, 200)

    def test_setup_command_needs_a_staff_account(self):
        from django.core.management.base import CommandError

        get_user_model().objects.create_user(username="member", password="x")
        with self.assertRaises(CommandError):
            call_command("add_admin_2fa", "member", stdout=open(os.devnull, "w"))


@override_settings(ALLOWED_HOSTS=["api.example.org"], SECURE_SSL_REDIRECT=True)
class HealthCheckTests(TestCase):
    """DigitalOcean may call the server by its internal address over HTTP (review N2)."""

    def test_answers_ok_by_internal_address_over_http(self):
        response = self.client.get("/healthz", HTTP_HOST="10.0.0.5:8080")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"ok")

    def test_the_rest_of_the_site_keeps_its_checks(self):
        self.assertEqual(self.client.get("/api/config", HTTP_HOST="10.0.0.5:8080").status_code, 400)
        self.assertEqual(self.client.get("/api/config", HTTP_HOST="api.example.org").status_code, 301)


class ServerImageTests(TestCase):
    def test_the_server_image_defaults_to_production(self):
        dockerfile = (BACKEND.parent / "Dockerfile").read_text()
        self.assertRegex(dockerfile, r"(?m)^ENV [^\n]*(\\\n[^\n]*)*DJANGO_DEBUG=0")


class ServerImageUserTests(TestCase):
    def test_the_server_runs_as_an_ordinary_user(self):
        dockerfile = (BACKEND.parent / "Dockerfile").read_text()
        self.assertRegex(dockerfile, r"(?m)^USER app$")
        self.assertLess(dockerfile.index("USER app"), dockerfile.index("CMD "))


class StagingTests(TestCase):
    """The staging server says so, and never buzzes phones (review D5, PLAN P27)."""

    def test_the_admin_header_names_a_staging_server(self):
        code = "from django.contrib import admin; import config.urls; print(admin.site.site_header)"
        staging = run_manage("shell", "-c", code, env={**PRODUCTION_ENV, "APP_ENVIRONMENT": "staging"})
        self.assertIn("(STAGING)", staging.stdout, staging.stderr)
        production = run_manage("shell", "-c", code, env=PRODUCTION_ENV)
        self.assertIn(f"{settings.APP_NAME} admin\n", production.stdout, production.stderr)
        self.assertNotIn("STAGING", production.stdout)

    def test_push_can_be_switched_off(self):
        from unittest import mock

        from accounts.models import Account
        from notifications.models import PushToken
        from notifications.push import send_to_user

        user = get_user_model().objects.create_user(username="ana@example.com", password="x")
        Account.objects.create(user=user)
        PushToken.objects.create(user=user, token="ExponentPushToken[a]")
        with override_settings(PUSH_ENABLED=False), mock.patch("notifications.push.post_to_expo") as expo:
            self.assertTrue(send_to_user(user, "Tomorrow 10:00 AM · Cleanup"))
        expo.assert_not_called()
