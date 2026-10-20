"""What the daily cleanup deletes, and what it keeps (owner decision D3, PLAN P26)."""

from datetime import timedelta
from unittest import mock

from django.core.management import call_command
from django.utils import timezone

from accounts.models import DeviceToken, EmailCode
from accounts.retention import cleanup
from badges.models import Attendance, Celebration
from events.models import Event, EventReport, Going, TranslationCache
from notifications.models import PushToken, ScheduledNotification
from organizations.models import Organization, OrganizationChangeRequest, OrganizationReport
from organizations.tests.helpers import OrgTestCase
from support.models import ProblemReport

LONG_AGO = timedelta(days=400)
RECENTLY = timedelta(days=10)


class CleanupTests(OrgTestCase):
    def setUp(self):
        super().setUp()
        self.now = timezone.now()
        self.old = self.event(starts=self.now - LONG_AGO, description="Bring gloves")
        self.recent = self.event(starts=self.now - RECENTLY, description="Bring snacks")
        for event in (self.old, self.recent):
            self.attend(self.ana, event)
            TranslationCache.objects.create(event=event, field="title", target_language="es", text="x")

    def aged(self, model, field, delta, **values):
        row = model.objects.create(**values)
        model.objects.filter(pk=row.pk).update(**{field: self.now - delta})
        return row

    def test_old_event_details_go_but_the_history_stays(self):
        cleanup(self.now)
        self.old.refresh_from_db()
        self.recent.refresh_from_db()
        self.assertEqual((self.old.location_text, self.old.description), ("", ""))
        self.assertTrue(self.old.title)  # title, time, place and host stay
        self.assertEqual(self.recent.description, "Bring snacks")
        self.assertEqual(Attendance.objects.filter(user=self.ana).count(), 2)  # participation history stays
        self.assertEqual(list(TranslationCache.objects.values_list("event", flat=True)), [self.recent.pk])

    def test_going_taps_for_events_over_a_year_ago(self):
        Going.objects.get_or_create(user=self.member("ben"), event=self.recent)
        Going.objects.get_or_create(user=self.member("cy"), event=self.old)
        cleanup(self.now)
        self.assertFalse(Going.objects.filter(event=self.old).exists())
        self.assertTrue(Going.objects.filter(event=self.recent).exists())

    def test_notifications_tokens_and_celebrations(self):
        upcoming = self.event(starts=self.now + timedelta(days=2))
        old_sent = self.aged(ScheduledNotification, "sent_at", timedelta(days=31), user=self.ana, event=self.old, kind="reminder", send_at=self.now)
        new_sent = self.aged(ScheduledNotification, "sent_at", timedelta(days=5), user=self.ana, event=self.recent, kind="reminder", send_at=self.now)
        waiting = ScheduledNotification.objects.create(user=self.ana, event=upcoming, kind="reminder", send_at=self.now)
        stale = self.aged(PushToken, "last_used_at", timedelta(days=91), user=self.ana, token="ExponentPushToken[old]")
        fresh = self.aged(PushToken, "last_used_at", timedelta(days=3), user=self.ana, token="ExponentPushToken[new]")
        Celebration.objects.all().delete()
        seen = self.aged(Celebration, "seen_at", timedelta(days=91), user=self.ana, badge_key="local", kind="stage_up", stage=1, count=1)
        unseen = Celebration.objects.create(user=self.ana, badge_key="local", kind="stage_up", stage=2, count=3)
        cleanup(self.now)
        remaining = set(ScheduledNotification.objects.values_list("pk", flat=True))
        self.assertEqual(remaining, {new_sent.pk, waiting.pk})
        self.assertNotIn(old_sent.pk, remaining)
        self.assertEqual(set(PushToken.objects.values_list("pk", flat=True)), {fresh.pk})
        self.assertFalse(PushToken.objects.filter(pk=stale.pk).exists())
        self.assertEqual(set(Celebration.objects.values_list("pk", flat=True)), {unseen.pk})
        self.assertFalse(Celebration.objects.filter(pk=seen.pk).exists())

    def test_reports_change_requests_and_problem_reports_after_a_year(self):
        org = self.org()
        self.aged(EventReport, "created_at", LONG_AGO, event=self.recent, reason="old")
        keep_report = self.aged(EventReport, "created_at", RECENTLY, event=self.recent, reason="new")
        self.aged(OrganizationReport, "created_at", LONG_AGO, organization=org, reason="old")
        self.aged(OrganizationChangeRequest, "decided_at", LONG_AGO, organization=org, name="Old", status="approved")
        pending = OrganizationChangeRequest.objects.create(organization=org, name="Waiting")
        self.aged(ProblemReport, "created_at", LONG_AGO, message="old bug")
        keep_problem = self.aged(ProblemReport, "created_at", RECENTLY, message="new bug")
        cleanup(self.now)
        self.assertEqual(list(EventReport.objects.values_list("pk", flat=True)), [keep_report.pk])
        self.assertFalse(OrganizationReport.objects.exists())
        self.assertEqual(list(OrganizationChangeRequest.objects.values_list("pk", flat=True)), [pending.pk])
        self.assertEqual(list(ProblemReport.objects.values_list("pk", flat=True)), [keep_problem.pk])
        self.assertTrue(Organization.objects.filter(pk=org.pk).exists())

    def test_expired_logins_and_codes(self):
        DeviceToken.objects.update(last_used_at=self.now - timedelta(days=91))
        self.aged(EmailCode, "expires_at", timedelta(minutes=1), user=self.ana, purpose="verify", code_hash="x", expires_at=self.now)
        cleanup(self.now)
        self.assertFalse(DeviceToken.objects.exists())
        self.assertFalse(EmailCode.objects.exists())

    def test_dry_run_only_counts(self):
        counts = cleanup(self.now, dry_run=True)
        self.assertEqual(counts["their cached translations"], 1)
        self.assertEqual(TranslationCache.objects.count(), 2)
        out = mock.MagicMock()
        call_command("cleanup_old_data", "--dry-run", stdout=out)
        self.assertIn("Would clean", "".join(str(c.args[0]) for c in out.write.call_args_list))
        self.assertEqual(TranslationCache.objects.count(), 2)
