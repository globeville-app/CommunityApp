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
    allow_unverified = True
    """
    POST /api/account/delete {"password": "..."}

    Deletes the member's login, profile, photo file, tokens and everything
    else tied to them. Their problem reports are kept so the team can still
    fix the bug, but with the user removed and any contact email cleared.

    RULE FOR EVERY FUTURE FEATURE (see README): content tied to a deleted
    member is either removed or shown as "Former neighbor", never with their
    name. When a feature adds data that points at a user, update this view.
    """

    throttle_scope = "auth"

    def post(self, request):
        serializer = DeleteAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(serializer.validated_data["password"]):
            raise ApiError("wrong_password")

        # Imported here to keep the accounts app free of a hard dependency
        # on the apps that store member data.
        from django.utils import timezone

        from events.models import Event
        from profiles.models import Profile
        from support.models import ProblemReport

        from badges.engine import update_badges

        from organizations.models import Organization

        # Hosts whose numbers include this member, to refresh afterwards.
        hosts = list(
            # Only members' own events: an organization event's host is the organization.
            get_user_model()
            .objects.filter(organized_events__organization__isnull=True, organized_events__attendances__user=user)
            .exclude(pk=user.pk)
            .distinct()
        )
        hosts += list(Organization.objects.filter(events__attendances__user=user).distinct())
        # Organizations they run: if they're the last admin, it's hidden
        # until the team assigns a new one (MILESTONE_4.md changes SETTINGS.md).
        their_orgs = list(Organization.objects.filter(admins__user=user))

        photo = None
        profile = Profile.objects.filter(user=user).first()
        if profile and profile.photo:
            photo = (profile.photo.storage, profile.photo.name)

        with transaction.atomic():
            ProblemReport.objects.filter(user=user).update(user=None, contact_email="")
            # Their upcoming events are cancelled. Past ones stay, and once
            # the user is gone they show "Former neighbor" as the organizer.
            # Organization events aren't theirs to cancel: they belong to the organization.
            cancelled = list(
                Event.objects.filter(
                    organizer=user, organization__isnull=True, starts_at__gt=timezone.now(), status=Event.Status.ACTIVE
                )
            )
            Event.objects.filter(pk__in=[e.pk for e in cancelled]).update(status=Event.Status.CANCELLED)
            # Deleting the user also deletes, through the database: the
            # profile (and its interests), the account settings, the
            # neighborhood match, every login token and their "I'm going"
            # records, attendance, badges and unlock moments. Events they
            # organized keep existing with no organizer.
            user.delete()
            # Their attendance drops out of these hosts' counts. Stages are
            # never lowered (badges/engine.py), only the counts change.
            for host in hosts:
                update_badges(host)
            for organization in their_orgs:
                if not organization.admins.exists():
                    organization.status = Organization.Status.HIDDEN
                    organization.save(update_fields=["status", "updated_at"])

        # Neighbors going to their cancelled events get a notice.
        from notifications.scheduling import event_cancelled

        for event in cancelled:
            event_cancelled(event)

        # Remove the photo file only once the database change has stuck.
        if photo:
            storage, name = photo
            storage.delete(name)
        return Response(status=status.HTTP_204_NO_CONTENT)
