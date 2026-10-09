from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

User = get_user_model()
PASSWORD = "correct horse battery staple"


class SignupTests(APITestCase):
    def test_signup_creates_user_and_returns_token(self):
        response = self.client.post(
            "/api/auth/signup", {"email": "Ana@Example.com ", "password": PASSWORD}, format="json"
        )
        self.assertEqual(response.status_code, 201)
        user = User.objects.get()
        self.assertEqual(user.username, "ana@example.com")
        self.assertEqual(user.email, "ana@example.com")
        self.assertEqual(response.data["token"], Token.objects.get(user=user).key)
        # The password is stored hashed, never as typed.
        self.assertNotEqual(user.password, PASSWORD)

    def test_duplicate_email_is_rejected(self):
        self.client.post("/api/auth/signup", {"email": "ana@example.com", "password": PASSWORD}, format="json")
        response = self.client.post(
            "/api/auth/signup", {"email": "ANA@example.com", "password": PASSWORD}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "email_taken")
        self.assertEqual(response.data["fields"], {"email": ["email_taken"]})

    def test_weak_password_is_rejected(self):
        response = self.client.post(
            "/api/auth/signup", {"email": "ana@example.com", "password": "12345678"}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        # Django's own rule codes, which the app translates.
        self.assertIn("password_entirely_numeric", response.data["fields"]["password"])
        self.assertIn(response.data["code"], response.data["fields"]["password"])

    def test_bad_email_is_rejected(self):
        response = self.client.post("/api/auth/signup", {"email": "nope", "password": PASSWORD}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data["fields"])


class LoginLogoutTests(APITestCase):
    def setUp(self):
        User.objects.create_user(username="ana@example.com", email="ana@example.com", password=PASSWORD)

    def test_login_returns_token(self):
        response = self.client.post(
            "/api/auth/login", {"email": "ANA@example.com", "password": PASSWORD}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["token"])

    def test_wrong_password_is_rejected_with_a_clear_message(self):
        response = self.client.post(
            "/api/auth/login", {"email": "ana@example.com", "password": "wrong"}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "invalid_credentials")
        self.assertEqual(response.data, {"code": "invalid_credentials"})

    def test_logout_deletes_the_token(self):
        token = self.client.post(
            "/api/auth/login", {"email": "ana@example.com", "password": PASSWORD}, format="json"
        ).data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")
        self.assertEqual(self.client.post("/api/auth/logout").status_code, 204)
        self.assertFalse(Token.objects.filter(key=token).exists())
        # The old token no longer works.
        self.assertEqual(self.client.post("/api/auth/logout").status_code, 401)

    def test_logout_requires_a_token(self):
        response = self.client.post("/api/auth/logout")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data["code"], "not_authenticated")


class ConfigTests(APITestCase):
    def test_config_is_public_and_reads_settings(self):
        response = self.client.get("/api/config")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["app_name"], settings.APP_NAME)
        # Interests now come from the event categories (events/tests).
        self.assertNotIn("interests", response.data)
        self.assertEqual(response.data["languages"], ["en", "es"])
