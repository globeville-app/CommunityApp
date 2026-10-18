"""Shared setup for event tests: members in made-up neighborhoods."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from accounts.models import Account
from neighborhoods.models import NeighborhoodMatch
from neighborhoods.testing import FixtureNeighborhoodsMixin
from profiles.models import Profile

from events.models import Event


class EventTestCase(FixtureNeighborhoodsMixin, APITestCase):
    def setUp(self):
        super().setUp()
        # Ana and Ben live in Highland (id 3); Cy lives in East Square (id 1).
        self.ana = self.member("ana@example.com", "Ana", 3, language="es")
        self.ben = self.member("ben@example.com", "Ben", 3)
        self.cy = self.member("cy@example.com", "Cy", 1)
        self.as_user(self.ana)

    def member(self, email, first_name, neighborhood_id, language="en", interests=()):
        user = get_user_model().objects.create_user(username=email, email=email, password="a long pass phrase")
        Account.objects.create(user=user, language=language)
        NeighborhoodMatch.objects.create(user=user, neighborhood_id=neighborhood_id)
        Profile.objects.create(
            user=user,
            first_name=first_name,
            last_initial="R",
            neighborhood_id=neighborhood_id,
            interests=list(interests),
        )
        Token.objects.create(user=user)
        return user

    def as_user(self, user):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {Token.objects.get(user=user).key}")

    def later(self, **kwargs):
        """A time in the future, in Denver time without a zone, as the app sends it."""
        when = timezone.localtime(timezone.now() + timedelta(**(kwargs or {"days": 3})))
        return when.strftime("%Y-%m-%dT%H:%M:%S")

    def event_body(self, **overrides):
        return {
            "category": "potluck",
            "title": "Fall potluck",
            "description": "Bring a dish to share.",
            "starts_at": self.later(days=3),
            "location_text": "Corner of 32nd and Lowell",
            # The map pin (a park in Highland).
            "latitude": 39.7615,
            "longitude": -105.0112,
            **overrides,
        }

    def post_event(self, **overrides):
        return self.client.post("/api/events", self.event_body(**overrides), format="json")

    def make_event(self, organizer, neighborhood_id=3, **fields):
        """Straight into the database, e.g. for past events the API can't create."""
        values = {
            "category": "potluck",
            "title": "Potluck",
            "starts_at": timezone.now() + timedelta(days=2),
            "location_text": "The park",
            **fields,
        }
        return Event.objects.create(neighborhood_id=neighborhood_id, organizer=organizer, **values)
