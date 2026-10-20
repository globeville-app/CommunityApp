"""Confirming the email at signup, and "Forgot password?" (review P5 and D1)."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from accounts.models import Account, EmailCode
from accounts.testing import latest_code
from notifications.models import PushToken

PASSWORD = "a long pass phrase"
NEW_PASSWORD = "another long phrase"
LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


class VerifyEmailTests(APITestCase):
    def setUp(self):
        reply = self.client.post(
            "/api/auth/signup", {"email": "ana@example.com", "password": PASSWORD, "language": "es"}, format="json"
        )
        self.reply = reply.data
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.reply['token']}")

    def verify(self, code):
        return self.client.post("/api/account/verify-email", {"code": code}, format="json")

    def test_signup_emails_a_code_in_the_members_language(self):
        self.assertFalse(self.reply["email_verified"])
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["ana@example.com"])
        self.assertIn("Tu código es", mail.outbox[0].body)

    def test_the_app_waits_for_the_code(self):
        response = self.client.get("/api/profile/me")
        self.assertEqual((response.status_code, response.data), (403, {"code": "email_not_verified"}))
        self.assertEqual(self.client.get("/api/events").data, {"code": "email_not_verified"})
        # What an unconfirmed member still needs works.
        self.assertEqual(self.client.patch("/api/profile/me", {"language": "en"}, format="json").status_code, 200)

    def test_the_right_code_confirms_the_email(self):
        self.assertEqual(self.verify("000000" if latest_code() != "000000" else "111111").data, {"code": "invalid_code"})
        self.assertEqual(self.verify(latest_code()).status_code, 204)
        self.assertTrue(Account.objects.get().email_verified)
        self.assertEqual(self.client.get("/api/profile/me").data, {"code": "profile_not_found"})
        login = self.client.post("/api/auth/login", {"email": "ana@example.com", "password": PASSWORD}, format="json")
        self.assertTrue(login.data["email_verified"])

    def test_a_code_works_once_for_a_short_time_and_a_few_tries(self):
        code = latest_code()
        EmailCode.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.verify(code).data, {"code": "invalid_code"})

        self.client.post("/api/account/verify-email/resend")
        code = latest_code()
        wrong = "000000" if code != "000000" else "111111"
        for _ in range(5):
            self.verify(wrong)
        self.assertEqual(self.verify(code).data, {"code": "invalid_code"})  # locked after 5 wrong tries

    def test_a_new_code_replaces_the_old_one(self):
        old = latest_code()
        self.client.post("/api/account/verify-email/resend")
        new = latest_code()
        if old != new:
            self.assertEqual(self.verify(old).data, {"code": "invalid_code"})
        self.assertEqual(self.verify(new).status_code, 204)

    def test_only_a_hash_of_the_code_is_stored(self):
        row = EmailCode.objects.get()
        self.assertNotIn(latest_code(), row.code_hash)
        self.assertEqual(row.code_hash, EmailCode.hash(latest_code()))

    @override_settings(REQUIRE_EMAIL_VERIFICATION=False)
    def test_can_be_switched_off_for_a_server_without_email(self):
        reply = self.client.post("/api/auth/signup", {"email": "bo@example.com", "password": PASSWORD}, format="json")
        self.assertTrue(reply.data["email_verified"])


class PasswordResetTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="ana@example.com", email="ana@example.com", password=PASSWORD
        )
        Account.objects.create(user=self.user, language="en")
        self.old_token = Token.objects.create(user=self.user)
        PushToken.objects.create(user=self.user, token="ExponentPushToken[old-phone]")

    def ask(self, email="ana@example.com"):
        return self.client.post("/api/auth/password-reset", {"email": email}, format="json")

    def confirm(self, code, password=NEW_PASSWORD, email="ana@example.com"):
        body = {"email": email, "code": code, "password": password}
        return self.client.post("/api/auth/password-reset/confirm", body, format="json")

    def test_the_reply_is_the_same_for_unknown_emails(self):
        self.assertEqual(self.ask("nobody@example.com").status_code, 204)
        self.assertEqual(mail.outbox, [])
        self.assertEqual(self.ask().status_code, 204)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("reset the password", mail.outbox[0].body)
        self.assertEqual(self.confirm("123456", email="nobody@example.com").data, {"code": "invalid_code"})

    def test_reset_logs_out_every_device_and_logs_this_one_in(self):
        self.ask()
        response = self.confirm(latest_code())
        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(response.data["token"], self.old_token.key)
        self.assertFalse(Token.objects.filter(key=self.old_token.key).exists())
        self.assertFalse(PushToken.objects.exists())  # old phones stop getting notifications
        login = self.client.post(
            "/api/auth/login", {"email": "ana@example.com", "password": NEW_PASSWORD}, format="json"
        )
        self.assertEqual(login.status_code, 200)

    def test_wrong_code_and_weak_password(self):
        self.ask()
        code = latest_code()
        wrong = "000000" if code != "000000" else "111111"
        self.assertEqual(self.confirm(wrong).data, {"code": "invalid_code"})
        weak = self.confirm(code, password="123")
        self.assertEqual(weak.status_code, 400)
        self.assertIn("password", weak.data["fields"])
        # The weak password didn't use the code up.
        self.assertEqual(self.confirm(code).status_code, 200)

    def test_reading_the_email_also_confirms_it(self):
        Account.objects.update(email_verified=False)
        self.ask()
        self.assertTrue(self.confirm(latest_code()).data["email_verified"])

    @override_settings(CACHES=LOCMEM)
    def test_at_most_five_emails_an_hour(self):
        cache.clear()
        for _ in range(7):
            self.ask()
        self.assertEqual(len(mail.outbox), 5)
