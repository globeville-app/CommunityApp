"""One login per phone, stored hashed, expiring when unused (review P15)."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from accounts.models import Account, DeviceToken

PASSWORD = "a long pass phrase"


class DeviceTokenTests(APITestCase):
    def setUp(self):
        user = get_user_model().objects.create_user(username="ana@example.com", password=PASSWORD)
        Account.objects.create(user=user)
        self.user = user

    def phone(self):
        """A new phone logging in."""
        client = APIClient()
        key = client.post("/api/auth/login", {"email": "ana@example.com", "password": PASSWORD}, format="json").data["token"]
        client.credentials(HTTP_AUTHORIZATION=f"Token {key}")
        return client, key

    def test_logging_out_on_one_phone_keeps_the_other_logged_in(self):
        phone, _ = self.phone()
        tablet, _ = self.phone()
        self.assertEqual(phone.post("/api/auth/logout").status_code, 204)
        self.assertEqual(phone.get("/api/profile/me").status_code, 401)
        self.assertEqual(tablet.get("/api/profile/me").data, {"code": "profile_not_found"})  # still logged in

    def test_only_a_hash_of_the_key_is_stored(self):
        _, key = self.phone()
        row = DeviceToken.objects.get()
        self.assertNotEqual(row.key_hash, key)
        self.assertNotIn(key, str(DeviceToken.objects.values()))

    def test_a_login_unused_for_90_days_stops_working(self):
        phone, _ = self.phone()
        DeviceToken.objects.update(last_used_at=timezone.now() - timedelta(days=91))
        self.assertEqual(phone.get("/api/profile/me").status_code, 401)
        self.assertFalse(DeviceToken.objects.exists())

    def test_use_keeps_it_fresh(self):
        phone, _ = self.phone()
        DeviceToken.objects.update(last_used_at=timezone.now() - timedelta(days=60))
        phone.get("/api/profile/me")
        self.assertGreater(DeviceToken.objects.get().last_used_at, timezone.now() - timedelta(minutes=1))
