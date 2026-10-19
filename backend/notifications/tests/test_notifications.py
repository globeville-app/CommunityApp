"""Reminders, cancellation notices and push tokens (docs/MILESTONE_4.md). Expo is always mocked."""

from datetime import timedelta
from unittest import mock

from django.core.management import call_command
from django.utils import timezone

from badges.tests.helpers import BadgeTestCase, denver
from events.models import Going
from notifications.models import PushToken, ScheduledNotification
from notifications.push import PushUnavailable
from notifications.scheduling import reminder_time
from notifications.sending import send_due_notifications
from profiles.models import Profile

TOKEN = "ExponentPushToken[abc123]"


def at(when):
    return mock.patch("django.utils.timezone.now", return_value=when)


def expo_ok(messages):
    return [{"status": "ok", "id": str(i)} for i, _ in enumerate(messages)]


class NotificationTestCase(BadgeTestCase):
    def setUp(self):
        super().setUp()
        self.sent = []

        def fake_expo(messages):
            self.sent.extend(messages)
            return expo_ok(messages)

        patcher = mock.patch("notifications.push.post_to_expo", side_effect=fake_expo)
        self.expo = patcher.start()
        self.addCleanup(patcher.stop)
        # Saturday Oct 24, 2026, 10:00 AM in Denver.
        self.saturday = denver(2026, 10, 24, 10)
        self.cleanup = self.event(starts=self.saturday, title="Alley Cleanup", category="cleanup")
        self.cleanup.location_text = "Behind 4400 Lowell"
        self.cleanup.save()

    def opt_in(self, user, reminders=True):
        Profile.objects.filter(user=user).update(reminders_enabled=reminders)
        PushToken.objects.create(user=user, token=f"ExponentPushToken[{user.pk}]", platform="ios")

    def going(self, user, event=None, when=None):
        with at(when or denver(2026, 10, 20, 12)):
            return self.api(user).put(f"/api/events/{(event or self.cleanup).pk}/going")


class ReminderTests(NotificationTestCase):
    def test_scheduled_for_5pm_denver_the_day_before(self):
        self.going(self.ana)
        reminder = ScheduledNotification.objects.get(user=self.ana)
        self.assertEqual(reminder.send_at, denver(2026, 10, 23, 17))
        self.assertEqual(reminder_time(self.cleanup), denver(2026, 10, 23, 17))

    def test_none_when_going_after_5pm_the_day_before(self):
        self.going(self.ana, when=denver(2026, 10, 23, 17, 30))
        self.assertFalse(ScheduledNotification.objects.exists())

    def test_untapping_removes_it(self):
        self.going(self.ana)
        with at(denver(2026, 10, 21, 9)):
            self.api(self.ana).delete(f"/api/events/{self.cleanup.pk}/going")
        self.assertFalse(ScheduledNotification.objects.exists())

    def test_sent_once_even_when_the_job_runs_twice(self):
        self.opt_in(self.ana)
        self.going(self.ana)
        with at(denver(2026, 10, 23, 16, 45)):
            self.assertEqual(send_due_notifications(), 0)  # not yet
        with at(denver(2026, 10, 23, 17, 5)):
            call_command("send_due_notifications", stdout=open("/dev/null", "w"))
            call_command("send_due_notifications", stdout=open("/dev/null", "w"))
        self.assertEqual(len(self.sent), 1)
        self.assertEqual(self.sent[0]["to"], f"ExponentPushToken[{self.ana.pk}]")
        self.assertEqual(self.sent[0]["body"], "Tomorrow 10:00 AM · Alley Cleanup")
        self.assertTrue(ScheduledNotification.objects.get().delivered)

    def test_text_is_title_and_time_only_never_the_meeting_spot(self):
        self.opt_in(self.ana)
        self.going(self.ana)
        with at(denver(2026, 10, 23, 17, 5)):
            send_due_notifications()
        self.assertNotIn("Lowell", str(self.sent))
        self.assertNotIn(self.cleanup.location_text, self.sent[0]["body"])
        self.assertEqual(set(self.sent[0]), {"to", "body", "sound", "data"})

    def test_spanish_uses_the_organizers_spanish_title(self):
        self.cleanup.title_alt = "Limpieza del callejón"
        self.cleanup.save()
        maria = self.member("maria", language="es")
        self.opt_in(maria)
        self.going(maria)
        with at(denver(2026, 10, 23, 17, 5)):
            send_due_notifications()
        self.assertEqual(self.sent[0]["body"], "Mañana 10:00 a. m. · Limpieza del callejón")

    def test_turned_on_later_still_covers_earlier_taps(self):
        self.going(self.ana)  # reminders still off
        self.opt_in(self.ana)
        with at(denver(2026, 10, 23, 17, 5)):
            send_due_notifications()
        self.assertEqual(len(self.sent), 1)

    def test_nothing_for_members_who_never_opted_in(self):
        PushToken.objects.create(user=self.ana, token=TOKEN)
        self.going(self.ana)
        with at(denver(2026, 10, 23, 17, 5)):
            send_due_notifications()
        self.assertEqual(self.sent, [])
        self.assertFalse(ScheduledNotification.objects.get().delivered)

    def test_moves_with_the_event(self):
        self.opt_in(self.ana)
        self.going(self.ana)
        self.cleanup.starts_at = denver(2026, 10, 31, 10)
        self.cleanup.ends_at = denver(2026, 10, 31, 12)
        self.cleanup.save()
        from notifications.scheduling import event_time_changed

        with at(denver(2026, 10, 21, 9)):
            event_time_changed(self.cleanup)
        self.assertEqual(ScheduledNotification.objects.get().send_at, denver(2026, 10, 30, 17))

    def test_moving_through_the_api_moves_it(self):
        self.going(self.ana)
        with at(denver(2026, 10, 21, 9)):
            response = self.api(self.host).patch(
                f"/api/events/{self.cleanup.pk}",
                {"starts_at": "2026-10-31T10:00", "ends_at": None},
                format="json",
            )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(ScheduledNotification.objects.get().send_at, denver(2026, 10, 30, 17))

    def test_expo_down_is_retried_next_run(self):
        self.opt_in(self.ana)
        self.going(self.ana)
        self.expo.side_effect = PushUnavailable
        with at(denver(2026, 10, 23, 17, 5)):
            send_due_notifications()
        self.assertIsNone(ScheduledNotification.objects.get().sent_at)
        self.expo.side_effect = lambda messages: (self.sent.extend(messages), expo_ok(messages))[1]
        with at(denver(2026, 10, 23, 17, 20)):
            send_due_notifications()
        self.assertEqual(len(self.sent), 1)

    def test_invalid_tokens_are_removed(self):
        self.opt_in(self.ana)
        PushToken.objects.create(user=self.ana, token="ExponentPushToken[gone]")
        self.going(self.ana)
        self.expo.side_effect = lambda messages: [
            {"status": "error", "details": {"error": "DeviceNotRegistered"}} if "gone" in m["to"] else {"status": "ok"}
            for m in messages
        ]
        with at(denver(2026, 10, 23, 17, 5)):
            send_due_notifications()
        self.assertEqual(list(PushToken.objects.values_list("token", flat=True)), [f"ExponentPushToken[{self.ana.pk}]"])


class CancellationTests(NotificationTestCase):
    def test_one_notice_to_members_going_with_alerts_on(self):
        on, off, not_going, no_phone = self.member("on"), self.member("off"), self.member("other"), self.member("nophone")
        self.opt_in(on, reminders=False)
        self.opt_in(off)
        Profile.objects.filter(user=off).update(cancellation_alerts_enabled=False)
        self.opt_in(not_going)
        for person in (on, off, no_phone):
            self.going(person)
        with at(denver(2026, 10, 22, 9)):
            self.api(self.host).post(f"/api/events/{self.cleanup.pk}/cancel")
            send_due_notifications()
        self.assertEqual([m["to"] for m in self.sent], [f"ExponentPushToken[{on.pk}]"])
        self.assertEqual(self.sent[0]["body"], "Cancelled: Alley Cleanup · Sat, Oct 24, 10:00 AM")
        # And no reminders later.
        with at(denver(2026, 10, 23, 17, 5)):
            send_due_notifications()
        self.assertEqual(len(self.sent), 1)

    def test_spanish_notice(self):
        maria = self.member("maria", language="es")
        self.opt_in(maria)
        self.going(maria)
        with at(denver(2026, 10, 22, 9)):
            self.api(self.host).post(f"/api/events/{self.cleanup.pk}/cancel")
        self.assertEqual(self.sent[0]["body"], "Cancelado: Alley Cleanup · sáb 24 oct, 10:00 a. m.")

    def test_deleting_the_organizers_account_notifies_too(self):
        from django.contrib.auth.hashers import make_password

        type(self.host).objects.filter(pk=self.host.pk).update(password=make_password("pw"))
        self.opt_in(self.ana)
        self.going(self.ana)
        with at(denver(2026, 10, 22, 9)):
            self.api(self.host).post("/api/account/delete", {"password": "pw"}, format="json")
        self.assertEqual(len(self.sent), 1)
        self.assertTrue(self.sent[0]["body"].startswith("Cancelled: Alley Cleanup"))


class TokenAndSettingsTests(NotificationTestCase):
    def test_register_and_remove_this_phone(self):
        client = self.api(self.ana)
        self.assertEqual(client.post("/api/me/push-tokens", {"token": TOKEN, "platform": "ios"}, format="json").status_code, 204)
        self.assertEqual(PushToken.objects.get().user, self.ana)
        # The same phone, now logged in as someone else.
        self.api(self.host).post("/api/me/push-tokens", {"token": TOKEN, "platform": "ios"}, format="json")
        self.assertEqual(PushToken.objects.get().user, self.host)
        self.api(self.host).delete("/api/me/push-tokens", {"token": TOKEN}, format="json")
        self.assertFalse(PushToken.objects.exists())
        self.assertEqual(client.post("/api/me/push-tokens", {"token": "nope"}, format="json").data, {"code": "invalid_push_token"})

    def test_tokens_go_with_the_account(self):
        from django.contrib.auth.hashers import make_password

        type(self.ana).objects.filter(pk=self.ana.pk).update(password=make_password("pw"))
        PushToken.objects.create(user=self.ana, token=TOKEN)
        self.api(self.ana).post("/api/account/delete", {"password": "pw"}, format="json")
        self.assertFalse(PushToken.objects.exists())

    def test_settings_and_the_one_time_ask(self):
        client = self.api(self.ana)
        profile = client.get("/api/profile/me").data
        self.assertEqual((profile["reminders_enabled"], profile["cancellation_alerts_enabled"], profile["notif_offer_shown"]), (False, True, False))
        changed = client.patch("/api/profile/me", {"reminders_enabled": True, "cancellation_alerts_enabled": False}, format="json").data
        self.assertEqual((changed["reminders_enabled"], changed["cancellation_alerts_enabled"]), (True, False))
        client.post("/api/me/notif-offer/seen")
        self.assertTrue(client.get("/api/profile/me").data["notif_offer_shown"])
