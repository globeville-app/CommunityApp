"""Sending the same form twice creates it once (review A7, PLAN P23)."""

from django.core.cache import cache
from django.test import override_settings

from events.models import Event
from events.tests.helpers import EventTestCase
from support.models import ProblemReport

LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


@override_settings(CACHES=LOCMEM)
class IdempotencyTests(EventTestCase):
    def setUp(self):
        super().setUp()
        cache.clear()

    def send(self, key=None):
        headers = {"HTTP_IDEMPOTENCY_KEY": key} if key else {}
        return self.client.post("/api/events", self.event_body(), format="json", **headers)

    def test_the_same_event_form_sent_twice_makes_one_event(self):
        first = self.send("form-1")
        again = self.send("form-1")
        self.assertEqual(first.status_code, 201)
        self.assertEqual((again.status_code, again.data["id"]), (201, first.data["id"]))
        self.assertEqual(Event.objects.count(), 1)
        # A new form (new key), or no key at all, makes a new event.
        self.send("form-2")
        self.send()
        self.assertEqual(Event.objects.count(), 3)

    def test_the_same_problem_report_sent_twice_is_kept_once(self):
        self.client.credentials()
        for _ in range(2):
            response = self.client.post(
                "/api/support/report", {"message": "Map is slow"}, format="multipart", HTTP_IDEMPOTENCY_KEY="r-1"
            )
            self.assertEqual(response.status_code, 201)
        self.assertEqual(ProblemReport.objects.count(), 1)
