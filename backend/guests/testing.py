"""Test helpers for guests: RSVP from the web page the way a browser would."""

import re
from datetime import timedelta

from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone

from events.models import InviteLink
from events.tests.helpers import EventTestCase
from texting.texter import FakeTexter

PHONE = "(303) 555-0123"
PHONE_E164 = "+13035550123"
LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


@override_settings(CACHES=LOCMEM, PUBLIC_BASE_URL="https://globeville.test", SMS_LIVE=False)
class GuestTestCase(EventTestCase):
    def setUp(self):
        super().setUp()
        cache.clear()
        FakeTexter.outbox.clear()
        # Ana (Highland) hosts a potluck three days from now, at 6 PM Denver time.
        starts = timezone.localtime(timezone.now() + timedelta(days=3)).replace(hour=18, minute=0, second=0, microsecond=0)
        self.event = self.make_event(
            self.ana, title="Fall potluck", location_text="Behind 4400 Lowell", starts_at=starts,
            ends_at=starts + timedelta(hours=2), latitude=39.76, longitude=-105.01,
        )
        self.code = InviteLink.current(self.event).code
        self.web = self.client_class()  # a browser with no app and no account

    def last_text(self):
        return FakeTexter.outbox[-1]

    def texted_code(self):
        return re.search(r"\b(\d{6})\b", self.last_text()[1]).group(1)

    def start(self, browser=None, **overrides):
        form = {
            "first_name": "Rosa",
            "phone": PHONE,
            "consent_event_texts": "on",
            **overrides,
        }
        return (browser or self.web).post(f"/e/{self.code}/rsvp", {k: v for k, v in form.items() if v is not None})

    def rsvp(self, browser=None, **overrides):
        """The whole flow: form, texted code, confirmed. Returns the verify response."""
        browser = browser or self.web
        page = self.start(browser, **overrides)
        assert page.status_code == 200, page.content
        pending = re.search(rb'name="pending" value="([^"]+)"', page.content).group(1).decode()
        return browser.post(f"/e/{self.code}/verify", {"pending": pending, "code": self.texted_code()})
