from django.conf import settings
from rest_framework import serializers

from accounts.models import language_of
from events.categories import INTEREST_KEYS, MAX_INTERESTS
from neighborhoods.geo import neighborhood_center


def clean_interests(value):
    """
    Interests are event category keys: at most 8, no duplicates, and never
    "other". Error codes: invalid_interest, too_many_interests.
    """
    if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
        raise serializers.ValidationError("invalid_interest", code="invalid_interest")
    if any(item not in INTEREST_KEYS for item in value) or len(set(value)) != len(value):
        raise serializers.ValidationError("invalid_interest", code="invalid_interest")
    if len(value) > MAX_INTERESTS:
        raise serializers.ValidationError("too_many_interests", code="too_many_interests")
    return value


class ProfileUpdateSerializer(serializers.Serializer):
    """PATCH /api/profile/me: change the language and/or the interests."""

    language = serializers.ChoiceField(choices=settings.LANGUAGES_AVAILABLE, required=False)
    interests = serializers.JSONField(required=False)
    auto_checkin = serializers.BooleanField(required=False)
    badge_visibility = serializers.ChoiceField(choices=["neighborhood", "private"], required=False)
    reminders_enabled = serializers.BooleanField(required=False)
    cancellation_alerts_enabled = serializers.BooleanField(required=False)

    def validate_interests(self, value):
        return clean_interests(value)


class ProfileInputSerializer(serializers.Serializer):
    """What the app sends to PUT /api/profile. Note: no neighborhood field."""

    first_name = serializers.CharField(max_length=50)
    last_name = serializers.CharField(max_length=100)
    alias = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    interests = serializers.JSONField(required=False, default=list)
    # Optional: the app sends it so the profile matches the phone's choice.
    language = serializers.ChoiceField(choices=settings.LANGUAGES_AVAILABLE, required=False)

    def validate_interests(self, value):
        return clean_interests(value)


def profile_json(profile, request):
    """The profile as the app sees it."""
    return {
        "display_name": profile.display_name,
        "first_name": profile.first_name,
        "last_initial": profile.last_initial,
        "photo_url": request.build_absolute_uri(profile.photo.url) if profile.photo else None,
        "interests": profile.interests,
        "neighborhood": {
            "id": profile.neighborhood_id,
            "name": profile.neighborhood.name,
            # Where the event pin map opens (MILESTONE_3.md); a point inside, not a home.
            "center": neighborhood_center(profile.neighborhood_id),
        },
        "alias": profile.alias or None,
        "role": profile.role,
        "id": profile.pk,  # the member id neighbors use for the member page
        "auto_checkin": profile.auto_checkin,
        "badge_visibility": profile.badge_visibility,
        "checkin_offer_shown": profile.checkin_offer_shown_at is not None,
        "reminders_enabled": profile.reminders_enabled,
        "cancellation_alerts_enabled": profile.cancellation_alerts_enabled,
        "notif_offer_shown": profile.notif_offer_shown_at is not None,
        "language": language_of(profile.user),
        "joined_at": profile.joined_at.isoformat(),
    }
