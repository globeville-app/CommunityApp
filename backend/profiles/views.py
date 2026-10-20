import logging
import time

from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import language_of, set_language
from config.errors import ApiError
from neighborhoods.aliases import aliases_for, get_alias_map
from neighborhoods.models import NeighborhoodMatch

from .models import Profile
from .photos import PhotoError, clean_photo
from .serializers import ProfileInputSerializer, ProfileUpdateSerializer, profile_json

logger = logging.getLogger(__name__)


def get_profile_or_404(user):
    try:
        return Profile.objects.select_related("neighborhood").get(user=user)
    except Profile.DoesNotExist:
        # The app uses this code to send the person to the Address screen.
        raise ApiError("profile_not_found", status_code=status.HTTP_404_NOT_FOUND) from None


class ProfileView(APIView):
    def put(self, request):
        """Create or update the signed-in user's profile."""
        data = ProfileInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        values = data.validated_data

        # The neighborhood always comes from the server's own match, never
        # from the app, so nobody can join a neighborhood they didn't match.
        match = NeighborhoodMatch.objects.filter(user=request.user).select_related("neighborhood").first()
        if match is None:
            raise ApiError("match_required", status_code=status.HTTP_409_CONFLICT)

        if "language" in values:
            set_language(request.user, values["language"])

        alias = values["alias"].strip()
        if alias and alias not in aliases_for(match.neighborhood.name, get_alias_map()):
            raise ApiError("invalid_alias")

        profile, created = Profile.objects.update_or_create(
            user=request.user,
            defaults={
                "first_name": values["first_name"].strip(),
                "last_initial": values["last_name"].strip()[:1].upper(),
                "neighborhood": match.neighborhood,
                "alias": alias,
                "interests": values["interests"],
            },
        )
        return Response(
            profile_json(profile, request),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class MyProfileView(APIView):
    # An unconfirmed member can still save their language (the app does that
    # right after login); reading the profile waits for the email code.
    allow_unverified = {"PATCH"}

    def get(self, request):
        return Response(profile_json(get_profile_or_404(request.user), request))

    def patch(self, request):
        """
        Change the language and/or interests: {"language": "es"},
        {"interests": ["gardening"]}. A language change also works part-way
        through joining, before the profile exists, because the language is
        kept on the account from signup on. Interests need a profile.
        """
        data = ProfileUpdateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        values = data.validated_data
        settable = ("interests", "auto_checkin", "badge_visibility", "reminders_enabled", "cancellation_alerts_enabled")
        profile_fields = [f for f in settable if f in values]
        if profile_fields:
            profile = get_profile_or_404(request.user)
            for field in profile_fields:
                setattr(profile, field, values[field])
            profile.save(update_fields=profile_fields)
        if "language" in values:
            set_language(request.user, values["language"])

        profile = Profile.objects.filter(user=request.user).select_related("neighborhood").first()
        if profile is None:
            return Response({"language": language_of(request.user)})
        return Response(profile_json(profile, request))


class ProfilePhotoView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        profile = get_profile_or_404(request.user)
        upload = request.FILES.get("photo")
        if upload is None:
            raise ApiError("photo_missing")
        # Size and timing only (never the image or its metadata), to help
        # diagnose slow uploads.
        started = time.monotonic()
        try:
            cleaned = clean_photo(upload)
        except PhotoError as error:
            logger.info("Profile photo rejected (%s), %.1f MB", error.code, upload.size / 1e6)
            raise ApiError(error.code) from None
        logger.info(
            "Profile photo received: %.1f MB, cleaned in %.1f s",
            upload.size / 1e6,
            time.monotonic() - started,
        )

        old_photo = profile.photo.name if profile.photo else None
        profile.photo.save(cleaned.name, cleaned, save=True)
        if old_photo:
            profile.photo.storage.delete(old_photo)
        return Response(profile_json(profile, request))
