"""Shared setup for badge tests: members, events, "I'm going" and attending."""

from datetime import datetime, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from accounts.models import Account
from badges import engine
from events.models import Event, Going
from events.timing import event_end
from neighborhoods.models import Neighborhood, NeighborhoodMatch
from profiles.models import Profile

User = get_user_model()


def denver(*args):
    return timezone.make_aware(datetime(*args), timezone.get_current_timezone())


class BadgeTestCase(TestCase):
    def setUp(self):
        self.highland = Neighborhood.objects.create(id=3, name="Highland", source_version="t")
        self.hale = Neighborhood.objects.create(id=1, name="Hale", source_version="t")
        self.host = self.member("host")
        self.ana = self.member("ana")
        self._day = 0

    def member(self, name, neighborhood=None, language="en"):
        neighborhood = neighborhood or self.highland
        user = User.objects.create_user(username=f"{name}@example.com", password="x")
        Account.objects.create(user=user, language=language)
        NeighborhoodMatch.objects.create(user=user, neighborhood=neighborhood)
        Profile.objects.create(user=user, first_name=name.title(), last_initial="R", neighborhood=neighborhood)
        Token.objects.create(user=user)
        return user

    def members(self, n, prefix="n", neighborhood=None):
        return [self.member(f"{prefix}{i}", neighborhood) for i in range(n)]

    def event(self, host=None, category="potluck", starts=None, neighborhood=None, **extra):
        """An event a few days apart from the last one (2025, in the past), with a pin."""
        if starts is None:
            self._day += 3
            starts = denver(2025, 1, 1, 18) + timedelta(days=self._day)
        values = {
            "neighborhood": neighborhood or self.highland,
            "organizer": host if host is not None else self.host,
            "category": category,
            "title": f"{category} {self._day}",
            "location_text": "The park",
            "starts_at": starts,
            "ends_at": starts + timedelta(hours=2),
            "latitude": 39.76,
            "longitude": -105.01,
            **extra,
        }
        return Event.objects.create(**values)

    def attend(self, user, event, method="collect"):
        """Tap I'm going, then collect just after the event (or check in during it)."""
        Going.objects.get_or_create(user=user, event=event)
        now = event_end(event) + timedelta(minutes=5) if method == "collect" else event.starts_at
        return engine.record_attendance(user, event, method, now=now)

    def state(self, user, key):
        from badges.models import BadgeState

        state = BadgeState.objects.filter(user=user, badge_key=key).first()
        return (state.stage, state.count) if state else (0, 0)

    def keepsakes(self, user):
        from badges.models import Keepsake

        return set(Keepsake.objects.filter(user=user).values_list("badge_key", flat=True))

    def api(self, user):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Token {Token.objects.get(user=user).key}")
        return client
