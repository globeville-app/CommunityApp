"""
Community badges (docs/BADGES.md): what a neighborhood is "known for",
from the last 12 months. Admin-only in Milestone 3: worked out when the
owner stats page loads, never stored, never shown in the app.
"""

from datetime import timedelta

from django.utils import timezone

from events.categories import GROUPS
from events.models import Event
from neighborhoods.models import Neighborhood

from . import config
from .models import Attendance

# Admin is in English (LANGUAGE.md); the app never shows these.
GROUP_LABELS = {
    "celebrate": "celebrations",
    "buy_swap": "markets and swaps",
    "entertainment": "entertainment",
    "get_active": "staying active",
    "community": "pitching in",
    "learn_connect": "learning together",
}


def known_for(now=None):
    """[(neighborhood name, ["Known for celebrations", ...])], only neighborhoods with any."""
    now = now or timezone.now()
    since = now - timedelta(days=365)
    # A "counted event": not cancelled, and it counts as hosted (2+ attendees).
    counted = Event.objects.filter(counted_hosted_at__isnull=False, starts_at__gte=since, starts_at__lte=now).exclude(
        status=Event.Status.CANCELLED
    )
    results = []
    for neighborhood in Neighborhood.objects.filter(events__in=counted).distinct().order_by("name"):
        events = counted.filter(neighborhood=neighborhood)
        badges = []
        for group, categories in GROUPS:
            group_events = events.filter(category__in=categories)
            neighbors = Attendance.objects.filter(event__in=group_events).values("user").distinct().count()
            if group_events.count() >= config.COMMUNITY_GROUP_MIN_EVENTS and neighbors >= config.COMMUNITY_GROUP_MIN_NEIGHBORS:
                badges.append(f"Known for {GROUP_LABELS[group]}")
        for category, label in config.COMMUNITY_SIGNATURES.items():
            signature_events = events.filter(category=category)
            neighbors = Attendance.objects.filter(event__in=signature_events).values("user").distinct().count()
            if (
                signature_events.count() >= config.COMMUNITY_SIGNATURE_MIN_EVENTS
                and neighbors >= config.COMMUNITY_SIGNATURE_MIN_NEIGHBORS
            ):
                badges.append(label)
        if badges:
            results.append((neighborhood.name, badges))
    return results
