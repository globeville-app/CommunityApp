"""
Checks for creating and editing events. Every problem is a code
(docs/LANGUAGE.md) that the app turns into words, e.g. "start_in_past".
"""

from decimal import Decimal, InvalidOperation
from urllib.parse import urlsplit

from django.conf import settings
from rest_framework import serializers, status

from config.errors import ApiError

from .categories import ALL_CATEGORY_KEYS, OTHER, OTHER_MAX_LENGTH
from .models import DESCRIPTION_MAX, LOCATION_MAX, TITLE_MAX, Event
from .timing import has_ended

# Pins must be in and around Denver (a generous box around the city).
DENVER_BOUNDS = {"lat": (39.55, 40.05), "lng": (-105.25, -104.55)}

PARTIFUL_HOSTS = {"partiful.com", "www.partiful.com"}

# The fields the app may send. sponsor_name is deliberately not here, so it
# can't be set through the API.
EDITABLE_FIELDS = [
    "category",
    "category_other",
    "title",
    "description",
    "language",
    "title_alt",
    "description_alt",
    "starts_at",
    "ends_at",
    "location_text",
    "partiful_url",
    "latitude",
    "longitude",
    "visibility",
]


def is_partiful_url(url):
    parts = urlsplit(url or "")
    return parts.scheme == "https" and (parts.hostname or "").lower() in PARTIFUL_HOSTS


def _text(data, field, max_length, required_code=None, too_long_code=None):
    value = str(data.get(field) or "").strip()
    if required_code and not value:
        raise ApiError(required_code)
    if len(value) > max_length:
        raise ApiError(too_long_code or f"{field}_too_long")
    return value


def _when(value, code):
    """
    Parse a date and time. A time without a zone, like "2026-10-24T18:00",
    is Denver time (settings.TIME_ZONE); Django stores it in UTC.
    """
    if value in (None, ""):
        return None
    try:
        return serializers.DateTimeField().to_internal_value(value)
    except serializers.ValidationError:
        raise ApiError(code) from None


def _pin(merged):
    """The map pin as two Decimals (6 places), or a code if it's missing or off the map."""
    lat, lng = merged.get("latitude"), merged.get("longitude")
    if lat in (None, "") or lng in (None, ""):
        raise ApiError("pin_required")
    try:
        lat = Decimal(str(lat)).quantize(Decimal("0.000001"))
        lng = Decimal(str(lng)).quantize(Decimal("0.000001"))
    except (InvalidOperation, ValueError):
        raise ApiError("invalid_pin") from None
    (lat_min, lat_max), (lng_min, lng_max) = DENVER_BOUNDS["lat"], DENVER_BOUNDS["lng"]
    if not (lat_min <= lat <= lat_max and lng_min <= lng <= lng_max):
        raise ApiError("pin_outside_denver")
    return lat, lng


def clean_event(data, *, event=None, default_language="en", now):
    """
    Checks the fields and returns them ready to save. For an edit (`event`
    given), fields that weren't sent keep their current values.
    """
    current = {field: getattr(event, field) for field in EDITABLE_FIELDS} if event else {}
    merged = {**current, **{key: data[key] for key in EDITABLE_FIELDS if key in data}}

    category = str(merged.get("category") or "")
    if category not in ALL_CATEGORY_KEYS:
        raise ApiError("invalid_category")
    # Badges already counted this event under its category, so it's fixed
    # once the event is over (docs/BADGES.md, Step 1 rule 7).
    if event is not None and has_ended(event, now) and category != event.category:
        raise ApiError("category_locked", status_code=status.HTTP_409_CONFLICT)
    category_other = ""
    if category == OTHER:
        category_other = _text(merged, "category_other", OTHER_MAX_LENGTH, "other_needs_text", "other_too_long")

    language = merged.get("language") or default_language
    if language not in settings.LANGUAGES_AVAILABLE:
        raise ApiError("invalid_language")

    cleaned = {
        "category": category,
        "category_other": category_other,  # cleared for any other category
        "language": language,
        "title": _text(merged, "title", TITLE_MAX, "title_required"),
        "description": _text(merged, "description", DESCRIPTION_MAX),
        "title_alt": _text(merged, "title_alt", TITLE_MAX),
        "description_alt": _text(merged, "description_alt", DESCRIPTION_MAX),
        "location_text": _text(merged, "location_text", LOCATION_MAX, "location_required", "location_too_long"),
    }

    starts_at = _when(merged.get("starts_at"), "invalid_start")
    ends_at = _when(merged.get("ends_at"), "invalid_end")
    if starts_at is None:
        raise ApiError("start_required")
    latitude, longitude = _pin(merged)
    if event is not None and event.starts_at <= now:
        # It already started: the time and the pin can't move anymore.
        moved_pin = event.latitude is not None and (latitude, longitude) != (event.latitude, event.longitude)
        if starts_at != event.starts_at or ends_at != event.ends_at or moved_pin:
            raise ApiError("event_started", status_code=status.HTTP_409_CONFLICT)
    elif starts_at <= now:
        raise ApiError("start_in_past")
    if ends_at is not None and ends_at <= starts_at:
        raise ApiError("end_before_start")
    cleaned["starts_at"] = starts_at
    cleaned["ends_at"] = ends_at
    cleaned["latitude"] = latitude
    cleaned["longitude"] = longitude

    partiful_url = str(merged.get("partiful_url") or "").strip()
    if partiful_url and not is_partiful_url(partiful_url):
        raise ApiError("invalid_partiful_url")
    cleaned["partiful_url"] = partiful_url

    # Who can see it (Milestone 5): the neighborhood calendar plus the link, or the link only.
    visibility = merged.get("visibility") or Event.Visibility.NEIGHBORHOOD
    if visibility not in Event.Visibility.values:
        raise ApiError("invalid_visibility")
    cleaned["visibility"] = visibility
    return cleaned
