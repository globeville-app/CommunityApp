"""Guest texts: when, only with consent, quiet hours, budget, replies (docs/MILESTONE_5.md, "Texting")."""

import base64
import hashlib
import hmac
from datetime import timedelta
from unittest import mock

from django.core import mail
from django.test import override_settings
from django.utils import timezone

from events.models import Event
from guests.models import Guest, GuestRSVP
from guests.testing import PHONE_E164, GuestTestCase
from notifications.scheduling import event_cancelled, event_time_changed
from texting.models import ScheduledText
from texting.sending import send_due_texts
from texting.texter import FakeTexter, TwilioTexter


def denver(dt):
    return timezone.localtime(dt)


def at(when):
    return mock.patch("django.utils.timezone.now", return_value=when)


class ScheduleTests(GuestTestCase):
    def test_reminder_at_5pm_the_day_before_and_collect_at_10am_after(self):
        self.rsvp(wants_reminder="on", consent_collect="on")
        reminder = ScheduledText.objects.get(kind="reminder")
        collect = ScheduledText.objects.get(kind="collect")
        day_before = denver(self.event.starts_at).date() - timedelta(days=1)
        self.assertEqual((denver(reminder.send_at).date(), denver(reminder.send_at).hour), (day_before, 17))
        day_after = denver(self.event.ends_at).date() + timedelta(days=1)
        self.assertEqual((denver(collect.send_at).date(), denver(collect.send_at).hour), (day_after, 10))

    def test_only_what_they_asked_for(self):
        self.rsvp()
        self.assertEqual(set(ScheduledText.objects.values_list("kind", flat=True)), {"code"})

    def test_each_text_goes_once_with_no_meeting_spot(self):
        self.rsvp(wants_reminder="on", consent_collect="on")
        FakeTexter.outbox.clear()
        reminder_time = ScheduledText.objects.get(kind="reminder").send_at
        with at(reminder_time + timedelta(minutes=5)):
            self.assertEqual(send_due_texts(), 1)
            self.assertEqual(send_due_texts(), 0)
        phone, body = FakeTexter.outbox[0]
        self.assertEqual(phone, PHONE_E164)
        self.assertIn("reminder, Fall potluck is tomorrow at 6:00 PM. Can't make it? https://globeville.test/r/", body)
        collect_time = ScheduledText.objects.get(kind="collect").send_at
        with at(collect_time + timedelta(minutes=5)):
            send_due_texts()
        body = FakeTexter.outbox[-1][1]
        self.assertIn("you went to Fall potluck! Collect your badge: https://globeville.test/c/", body)
        self.assertTrue(body.endswith("Reply STOP to opt out."))
        self.assertNotIn("Lowell", " ".join(b for _, b in FakeTexter.outbox))

    def test_spanish_guests_get_spanish_texts(self):
        self.rsvp(browser=self.client_class(HTTP_ACCEPT_LANGUAGE="es"))
        self.assertIn("tu código es", self.last_text()[1])

    def test_quiet_hours_hold_texts_until_9am(self):
        self.rsvp()
        late = denver(self.event.starts_at).replace(hour=22, minute=30) - timedelta(days=1)
        with at(late):
            event_cancelled(Event.objects.get(pk=self.event.pk), now=late)
        text = ScheduledText.objects.get(kind="cancelled")
        self.assertIsNone(text.sent_at)
        self.assertEqual(denver(text.send_at).hour, 9)
        with at(text.send_at + timedelta(minutes=1)):
            send_due_texts()
        self.assertIn("Fall potluck on ", self.last_text()[1])
        self.assertIn("was cancelled by the host.", self.last_text()[1])

    def test_a_cancelled_event_texts_guests_and_drops_reminders_and_collects(self):
        self.rsvp(wants_reminder="on", consent_collect="on")
        noon = denver(self.event.starts_at).replace(hour=12) - timedelta(days=2)
        with at(noon):
            Event.objects.filter(pk=self.event.pk).update(status="cancelled")
            event_cancelled(Event.objects.get(pk=self.event.pk), now=noon)
        kinds = set(ScheduledText.objects.values_list("kind", flat=True))
        self.assertEqual(kinds, {"code", "cancelled"})
        self.assertIsNotNone(ScheduledText.objects.get(kind="cancelled").sent_at)  # right away, in the daytime

    def test_moving_the_event_moves_the_texts(self):
        self.rsvp(wants_reminder="on", consent_collect="on")
        Event.objects.filter(pk=self.event.pk).update(
            starts_at=self.event.starts_at + timedelta(days=2), ends_at=self.event.ends_at + timedelta(days=2)
        )
        event_time_changed(Event.objects.get(pk=self.event.pk))
        reminder = ScheduledText.objects.get(kind="reminder")
        self.assertEqual(denver(reminder.send_at).date(), denver(self.event.starts_at).date() + timedelta(days=1))

    def test_opted_out_and_cancelled_rsvps_get_nothing(self):
        self.rsvp(wants_reminder="on")
        Guest.objects.update(opted_out_at=timezone.now())
        FakeTexter.outbox.clear()
        with at(ScheduledText.objects.get(kind="reminder").send_at + timedelta(minutes=1)):
            send_due_texts()
        self.assertEqual(FakeTexter.outbox, [])
        self.assertEqual(ScheduledText.objects.get(kind="reminder").skipped_reason, "opted_out")


@override_settings(SMS_MONTHLY_BUDGET_USD=1.0, SMS_COST_PER_TEXT_USD=0.25, OWNER_ALERT_EMAILS=["owner@example.com"])
class BudgetTests(GuestTestCase):
    def test_80_percent_emails_the_owner_and_100_percent_pauses_optional_texts(self):
        self.rsvp(wants_reminder="on")  # the code: $0.25
        others = [self.client_class() for _ in range(3)]
        for i, browser in enumerate(others):
            self.rsvp(browser=browser, phone=f"(303) 555-01{i + 3}0")
        # Four codes = $1.00: at 80% one email went out, and only one.
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("80%", mail.outbox[0].subject)
        with at(ScheduledText.objects.filter(kind="reminder").first().send_at + timedelta(minutes=1)):
            send_due_texts()
        self.assertEqual(ScheduledText.objects.get(kind="reminder").skipped_reason, "budget")
        # Codes still go.
        self.start(self.client_class(), phone="(303) 555-0177")
        self.assertIn("your code is", self.last_text()[1])


class LiveSwitchTests(GuestTestCase):
    def test_the_real_provider_is_never_called_while_sms_live_is_off(self):
        with mock.patch.object(TwilioTexter, "send") as real, mock.patch("httpx.post") as network:
            self.rsvp(wants_reminder="on")
        real.assert_not_called()
        network.assert_not_called()
        self.assertTrue(FakeTexter.outbox)


def sign(url, params, token="test-token"):
    payload = url + "".join(f"{key}{params[key]}" for key in sorted(params))
    return base64.b64encode(hmac.new(token.encode(), payload.encode(), hashlib.sha1).digest()).decode()


@override_settings(TWILIO_AUTH_TOKEN="test-token", SUPPORT_EMAIL="help@example.com")
class ReplyWebhookTests(GuestTestCase):
    URL = "http://testserver/webhooks/sms"

    def reply(self, body, signed=True):
        params = {"From": PHONE_E164, "Body": body}
        headers = {"HTTP_X_TWILIO_SIGNATURE": sign(self.URL, params)} if signed else {}
        return self.web.post("/webhooks/sms", params, **headers)

    def test_the_signature_is_required(self):
        self.rsvp()
        self.assertEqual(self.reply("STOP", signed=False).status_code, 403)
        self.assertIsNone(Guest.objects.get().opted_out_at)

    def test_stop_in_english_or_spanish_opts_out_at_once_and_start_opts_back_in(self):
        for word in ("STOP", "alto", " Parar "):
            Guest.objects.update(opted_out_at=None)
            self.rsvp(browser=self.client_class(), wants_reminder="on")
            ScheduledText.objects.filter(kind="reminder").update(skipped_reason="")
            self.assertEqual(self.reply(word).status_code, 200)
            self.assertIsNotNone(Guest.objects.get().opted_out_at)
            self.assertEqual(ScheduledText.objects.get(kind="reminder").skipped_reason, "opted_out")
        # Nothing at all, not even a code.
        self.assertContains(self.start(self.client_class()), "Reply START", status_code=400)
        self.reply("START")
        self.assertIsNone(Guest.objects.get().opted_out_at)

    def test_help_replies_with_the_support_email(self):
        self.rsvp()
        response = self.reply("HELP")
        self.assertIn(b"event texts for RSVPs. Reply STOP to opt out. Help: help@example.com", response.content)
        # From a number we don't know, AYUDA is answered in Spanish.
        Guest.objects.all().delete()
        self.assertIn("Responde STOP".encode(), self.reply("AYUDA").content)
