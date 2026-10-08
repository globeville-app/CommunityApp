from django.conf import settings
from rest_framework import serializers

from accounts.models import language_of


class LanguageSerializer(serializers.Serializer):
    """PATCH /api/profile/me: {"language": "en" | "es"}."""

    language = serializers.ChoiceField(choices=settings.LANGUAGES_AVAILABLE)


class ProfileInputSerializer(serializers.Serializer):
    """What the app sends to PUT /api/profile. Note: no neighborhood field."""

    first_name = serializers.CharField(max_length=50)
    last_name = serializers.CharField(max_length=100)
    alias = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    interests = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    # Optional: the app sends it so the profile matches the phone's choice.
    language = serializers.ChoiceField(choices=settings.LANGUAGES_AVAILABLE, required=False)

    def validate_interests(self, value):
        unknown = [item for item in value if item not in settings.INTEREST_CHOICES]
        if unknown:
            raise serializers.ValidationError("unknown_interest", code="unknown_interest")
        # Keep the official order and drop duplicates.
        return [choice for choice in settings.INTEREST_CHOICES if choice in value]


def profile_json(profile, request):
    """The profile as the app sees it."""
    return {
        "display_name": profile.display_name,
        "first_name": profile.first_name,
        "last_initial": profile.last_initial,
        "photo_url": request.build_absolute_uri(profile.photo.url) if profile.photo else None,
        "interests": profile.interests,
        "neighborhood": {"id": profile.neighborhood_id, "name": profile.neighborhood.name},
        "alias": profile.alias or None,
        "language": language_of(profile.user),
        "joined_at": profile.joined_at.isoformat(),
    }
