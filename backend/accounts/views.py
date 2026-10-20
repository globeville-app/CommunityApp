"""
Email + password login. The app gets a token and sends it with every request.

All login logic lives in this app, so phone-number login (v2) can be added
here later without touching neighborhoods or profiles.
"""

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import ErrorDetail, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from config.errors import ApiError

from . import codes
from .deletion import delete_member
from .models import Account, EmailCode, language_of
from .serializers import DeleteAccountSerializer, LoginSerializer, SignupSerializer, normalize_email


class SignupView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        if settings.REQUIRE_EMAIL_VERIFICATION:
            Account.objects.filter(user=user).update(email_verified=False)
            codes.send_code(user, EmailCode.Purpose.VERIFY)
        token = Token.objects.create(user=user)
        return Response(auth_reply(user, token), status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            request,
            username=normalize_email(serializer.validated_data["email"]),
            password=serializer.validated_data["password"],
        )
        if user is None:
            # Same message whether the email or the password was wrong.
            raise ApiError("invalid_credentials")
        token, _ = Token.objects.get_or_create(user=user)
        return Response(auth_reply(user, token))


def auth_reply(user, token):
    """
    What signup, login and password reset answer. The saved language lets a
    phone with no choice of its own start in the member's language
    (docs/LANGUAGE.md); email_verified says whether to ask for the code first.
    """
    verified = not Account.objects.filter(user=user, email_verified=False).exists()
    return {"token": token.key, "language": language_of(user), "email_verified": verified}


class PasswordResetView(APIView):
    """ "Forgot password?": email a 6-digit code. The reply is the same whether or not the email has an account."""

    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        email = normalize_email(str(request.data.get("email") or ""))
        user = get_user_model().objects.filter(username=email, is_active=True).first() if email else None
        if user is not None:
            codes.send_code(user, EmailCode.Purpose.RESET)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PasswordResetConfirmView(APIView):
    """
    The code from the email plus a new password. Every device is logged out
    (and stops getting notifications); this phone gets a fresh login.
    """

    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        email = normalize_email(str(request.data.get("email") or ""))
        password = request.data.get("password")
        user = get_user_model().objects.filter(username=email, is_active=True).first() if email else None
        if not isinstance(password, str) or not password:
            raise ValidationError({"password": [ErrorDetail("required", code="required")]})
        if user is not None:
            # Checked before the code, so a weak password doesn't use the code up.
            try:
                validate_password(password, user=user)
            except DjangoValidationError as error:
                raise ValidationError(
                    {"password": [ErrorDetail(e.code or "invalid", code=e.code or "invalid") for e in error.error_list]}
                ) from None
        # Same answer for an unknown email and a wrong code.
        if user is None or not codes.use_code(user, EmailCode.Purpose.RESET, request.data.get("code")):
            raise ApiError("invalid_code")

        from notifications.models import PushToken

        with transaction.atomic():
            user.set_password(password)
            user.save(update_fields=["password"])
            # Reading the code proves the email is theirs.
            Account.objects.filter(user=user).update(email_verified=True)
            Token.objects.filter(user=user).delete()
            PushToken.objects.filter(user=user).delete()
            token = Token.objects.create(user=user)
        return Response(auth_reply(user, token))


class VerifyEmailView(APIView):
    """The code from the welcome email. Wrong or expired codes answer invalid_code."""

    allow_unverified = True
    throttle_scope = "auth"

    def post(self, request):
        if not codes.use_code(request.user, EmailCode.Purpose.VERIFY, request.data.get("code")):
            raise ApiError("invalid_code")
        Account.objects.filter(user=request.user).update(email_verified=True)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ResendVerificationView(APIView):
    """Send a new code (the old one stops working). Nothing to do once confirmed."""

    allow_unverified = True
    throttle_scope = "auth"

    def post(self, request):
        if Account.objects.filter(user=request.user, email_verified=False).exists():
            codes.send_code(request.user, EmailCode.Purpose.VERIFY)
        return Response(status=status.HTTP_204_NO_CONTENT)


class LogoutView(APIView):
    allow_unverified = True

    def post(self, request):
        # This phone stops getting notifications (the app sends its push token).
        from notifications.models import PushToken

        push_token = request.data.get("push_token") if hasattr(request.data, "get") else None
        if push_token:
            PushToken.objects.filter(user=request.user, token=str(push_token)).delete()
        # Deleting the token means it can never be used again, even if it
        # was copied off the phone.
        request.auth.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DeleteAccountView(APIView):
    """
    POST /api/account/delete {"password": "..."}

    Deletes the member and everything tied to them (accounts/deletion.py,
    which the admin's delete uses too).
    """

    allow_unverified = True
    throttle_scope = "auth"

    def post(self, request):
        serializer = DeleteAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not request.user.check_password(serializer.validated_data["password"]):
            raise ApiError("wrong_password")
        delete_member(request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)
