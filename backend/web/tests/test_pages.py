"""The guest web pages (docs/MILESTONE_5.md, "Web pages" and "Guests and consent")."""

import re

from django.test import override_settings

from events.models import Event, InviteLink
from guests.models import Guest, GuestConsent, GuestRSVP, PhoneCode
from guests.testing import PHONE, PHONE_E164, GuestTestCase
from texting.models import ScheduledText
from web.models import DailyCount


class EventPageTests(GuestTestCase):
    def test_anyone_with_the_link_sees_the_event_but_not_the_meeting_spot(self):
        page = self.web.get(f"/e/{self.code}")
        self.assertContains(page, "Fall potluck")
        self.assertContains(page, "Hosted by Ana R.")
        self.assertContains(page, "0 people going")
        self.assertNotContains(page, "Lowell")  # hidden until they RSVP
        self.assertEqual(DailyCount.objects.get(key="web_page_view").count, 1)

    def test_link_previews_never_include_the_meeting_spot(self):
        page = self.web.get(f"/e/{self.code}").content.decode()
        og = " ".join(re.findall(r'<meta property="og:[^>]+>', page))
        self.assertIn('og:title" content="Fall potluck"', og)
        self.assertIn("og-default.png", og)
        self.assertNotIn("Lowell", og)

    def test_english_or_spanish(self):
        self.assertContains(self.web.get(f"/e/{self.code}", HTTP_ACCEPT_LANGUAGE="es-MX,es"), "Organizado por Ana R.")
        page = self.web.get(f"/e/{self.code}?lang=en", HTTP_ACCEPT_LANGUAGE="es")
        self.assertContains(page, "Hosted by")
        # The switch is remembered.
        self.assertContains(self.web.get(f"/e/{self.code}", HTTP_ACCEPT_LANGUAGE="es"), "Hosted by")
        self.assertContains(self.web.get(f"/e/{self.code}?lang=es"), "Envíenme un código")

    def test_expired_unknown_and_cancelled(self):
        InviteLink.objects.update(revoked_at="2026-01-01T00:00Z")
        self.assertContains(self.web.get(f"/e/{self.code}"), "This invite link has expired", status_code=410)
        self.assertEqual(self.web.get("/e/nothinghere").status_code, 404)
        InviteLink.objects.update(revoked_at=None)
        Event.objects.update(status="cancelled")
        self.assertContains(self.web.get(f"/e/{self.code}"), "This event was cancelled.", status_code=410)


class GuestRsvpTests(GuestTestCase):
    def test_the_whole_rsvp(self):
        page = self.start()
        self.assertContains(page, "Enter the code we texted you")
        phone, body = self.last_text()
        self.assertEqual(phone, PHONE_E164)
        self.assertRegex(body, r": your code is \d{6}\. It expires in 10 minutes\.$")
        self.assertNotIn(PHONE_E164, page.content.decode())
        done = self.rsvp()
        self.assertRedirects(done, f"/e/{self.code}", fetch_redirect_response=False)
        going = self.web.get(f"/e/{self.code}")
        self.assertContains(going, "You're going!")
        self.assertContains(going, "Behind 4400 Lowell")  # the meeting spot, now
        self.assertContains(going, "1 person going")
        calendar = self.web.get(f"/e/{self.code}/calendar.ics")
        self.assertEqual(calendar["Content-Type"], "text/calendar")
        self.assertIn(b"Behind 4400 Lowell", calendar.content)
        guest = Guest.objects.get()
        self.assertEqual((guest.first_name, guest.phone), ("Rosa", PHONE_E164))
        self.assertIsNotNone(guest.phone_verified_at)

    def test_the_calendar_file_is_only_for_guests_who_rsvpd(self):
        self.assertEqual(self.web.get(f"/e/{self.code}/calendar.ics").status_code, 404)

    def test_cant_make_it_on_the_page(self):
        self.rsvp(wants_reminder="on")
        self.web.post(f"/e/{self.code}/cancel-rsvp")
        self.assertIsNotNone(GuestRSVP.objects.get().cancelled_at)
        self.assertFalse(ScheduledText.objects.filter(kind="reminder").exists())
        self.assertContains(self.web.get(f"/e/{self.code}"), "0 people going")

    def test_the_required_consent_and_a_us_number(self):
        self.assertContains(self.start(consent_event_texts=None), "Please check the box", status_code=400)
        self.assertContains(self.start(phone="+44 20 7946 0958"), "Please enter a US mobile number", status_code=400)
        self.assertContains(self.start(phone="555"), "Please enter a US mobile number", status_code=400)
        self.assertEqual(Guest.objects.count(), 0)

    def test_codes_expire_and_five_wrong_tries_lock_them(self):
        page = self.start()
        pending = re.search(rb'name="pending" value="([^"]+)"', page.content).group(1).decode()
        for _ in range(4):
            self.assertContains(self.web.post(f"/e/{self.code}/verify", {"pending": pending, "code": "000000" if self.texted_code() != "000000" else "111111"}), "Check the text and try again", status_code=400)
        locked = self.web.post(f"/e/{self.code}/verify", {"pending": pending, "code": "000000" if self.texted_code() != "000000" else "111111"})
        self.assertContains(locked, "Too many wrong tries", status_code=400)
        right = self.web.post(f"/e/{self.code}/verify", {"pending": pending, "code": self.texted_code()})
        self.assertEqual(right.status_code, 400)
        self.assertFalse(GuestRSVP.objects.exists())

        self.start()
        PhoneCode.objects.update(expires_at="2020-01-01T00:00Z")
        pending = re.search(rb'name="pending" value="([^"]+)"', self.start().content).group(1).decode()
        PhoneCode.objects.update(expires_at="2020-01-01T00:00Z")
        expired = self.web.post(f"/e/{self.code}/verify", {"pending": pending, "code": self.texted_code()})
        self.assertContains(expired, "That code has expired", status_code=400)

    def test_consent_is_recorded_only_on_verify_versioned_and_never_rewritten(self):
        self.start(consent_collect="on")
        self.assertFalse(GuestConsent.objects.exists())
        self.rsvp(consent_collect="on")
        kinds = sorted(GuestConsent.objects.values_list("kind", "consent_version", "language"))
        self.assertEqual(kinds, [("collect_texts", "2026-10-v1", "en"), ("event_texts", "2026-10-v1", "en")])
        self.rsvp(browser=self.client_class())  # again, without the collect consent: new rows, old ones kept
        self.assertEqual(GuestConsent.objects.filter(kind="event_texts").count(), 2)
        self.assertEqual(GuestConsent.objects.filter(kind="collect_texts").count(), 1)

    def test_without_the_collect_consent_no_collect_text(self):
        self.rsvp()
        self.assertFalse(ScheduledText.objects.filter(kind="collect").exists())
        self.rsvp(browser=self.client_class(), consent_collect="on")
        self.assertTrue(ScheduledText.objects.filter(kind="collect").exists())

    def test_going_count_includes_guests_and_drops_when_the_host_removes_one(self):
        self.rsvp()
        self.as_user(self.ben)
        self.assertEqual(self.client.get(f"/api/events/{self.event.pk}").data["going_count"], 1)
        self.client.put(f"/api/events/{self.event.pk}/going")
        self.assertEqual(self.client.get(f"/api/events/{self.event.pk}").data["going_count"], 2)
        from guests.rsvp import remove_by_host

        remove_by_host(GuestRSVP.objects.get())
        self.assertEqual(self.client.get(f"/api/events/{self.event.pk}").data["going_count"], 1)

    def test_phone_numbers_never_reach_the_logs_or_pages(self):
        with self.assertLogs(level="DEBUG") as logs:
            self.rsvp()
            page = self.web.get(f"/e/{self.code}").content.decode()
        everything = "\n".join(logs.output) + page
        for form in (PHONE_E164, "3035550123", "555-0123"):
            self.assertNotIn(form, everything)


@override_settings(CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}})
class AbuseLimitTests(GuestTestCase):
    def test_three_codes_per_phone_per_hour(self):
        for _ in range(3):
            self.assertEqual(self.start().status_code, 200)
        self.assertContains(self.start(), "Too many tries", status_code=400)

    def test_thirty_tries_per_ip_per_hour(self):
        for i in range(30):
            self.start(phone="555")  # refused for the number, but each try counts
        self.assertContains(self.start(), "Too many tries", status_code=400)

    def test_the_200_guest_cap(self):
        from unittest import mock

        with mock.patch("guests.rsvp.MAX_GUESTS_PER_EVENT", 1):
            self.rsvp()
            other = self.client_class()
            self.assertContains(self.start(other, phone="(303) 555-0199"), "reached its limit", status_code=400)

    def test_blocked_and_opted_out_numbers(self):
        self.rsvp()
        Guest.objects.update(blocked_at="2026-01-01T00:00Z")
        self.assertContains(self.start(self.client_class()), "RSVP here", status_code=400)
        Guest.objects.update(blocked_at=None, opted_out_at="2026-01-01T00:00Z")
        self.assertContains(self.start(self.client_class()), "Reply START", status_code=400)


class CantMakeItLinkTests(GuestTestCase):
    def test_one_tap_without_signing_in(self):
        from texting.sending import cant_make_it_link

        self.rsvp(wants_reminder="on")
        link = cant_make_it_link(GuestRSVP.objects.get()).replace("https://globeville.test", "")
        stranger = self.client_class()
        self.assertContains(stranger.get(link), "I can't make it")
        self.assertContains(stranger.post(link), "You're no longer going")
        self.assertIsNotNone(GuestRSVP.objects.get().cancelled_at)
        self.assertFalse(ScheduledText.objects.filter(kind="reminder").exists())
        self.assertEqual(stranger.get("/r/forged-token").status_code, 404)


class DeepLinkFileTests(GuestTestCase):
    @override_settings(APPLE_TEAM_ID="TEAM123", ANDROID_CERT_SHA256="AB:CD")
    def test_the_well_known_files(self):
        apple = self.web.get("/.well-known/apple-app-site-association").json()
        self.assertEqual(apple["applinks"]["details"][0]["components"], [{"/": "/e/*"}, {"/": "/c/*"}])
        self.assertTrue(apple["applinks"]["details"][0]["appIDs"][0].startswith("TEAM123.app."))
        android = self.web.get("/.well-known/assetlinks.json").json()
        self.assertEqual(android[0]["target"]["sha256_cert_fingerprints"], ["AB:CD"])
