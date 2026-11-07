"""Report a member: offensive name or photo, harassment (Apple's rule for apps where people post)."""

from datetime import timedelta

from django.contrib.auth.models import User
from django.utils import timezone

from accounts.retention import cleanup
from badges.tests.helpers import BadgeTestCase
from profiles.models import MemberReport, Profile


class MemberReportTests(BadgeTestCase):
    def setUp(self):
        super().setUp()
        self.host_id = Profile.objects.get(user=self.host).pk

    def report(self, reason, member_id=None):
        return self.api(self.ana).post(f"/api/members/{member_id or self.host_id}/report", {"reason": reason})

    def test_a_neighbor_reports_a_member_for_the_team(self):
        self.assertEqual(self.report("  Rude photo  ").status_code, 201)
        report = MemberReport.objects.get()
        self.assertEqual((report.reported, report.reporter, report.reason), (self.host, self.ana, "Rude photo"))
        # Nothing tells the reported member.
        self.assertNotIn("report", str(self.api(self.host).get(f"/api/members/{self.host_id}").data).lower())

    def test_the_rules(self):
        self.assertEqual(self.report("").data, {"code": "reason_required"})
        self.assertEqual(self.report("x" * 201).data, {"code": "reason_too_long"})
        me = Profile.objects.get(user=self.ana).pk
        self.assertEqual(self.report("me", me).data, {"code": "cant_report_yourself"})
        outsider = Profile.objects.get(user=self.member("out", self.hale)).pk
        self.assertEqual(self.report("far away", outsider).status_code, 404)
        self.assertFalse(MemberReport.objects.exists())

    def test_reports_go_with_the_reported_account_and_after_a_year(self):
        self.report("one")
        self.ana.delete()  # the reporter leaving keeps the report
        self.assertIsNone(MemberReport.objects.get().reporter)
        MemberReport.objects.update(created_at=timezone.now() - timedelta(days=400))
        cleanup()
        self.assertFalse(MemberReport.objects.exists())

        MemberReport.objects.create(reported=self.host, reason="two")
        User.objects.filter(pk=self.host.pk).delete()
        self.assertFalse(MemberReport.objects.exists())

    def test_the_team_sees_it_in_admin_with_a_link_to_the_member(self):
        self.report("Rude photo")
        staff = User.objects.create_superuser("boss@example.com", "boss@example.com", "pw")
        self.client.force_login(staff)
        page = self.client.get("/admin/profiles/memberreport/")
        self.assertContains(page, "Rude photo")
        self.assertContains(page, f"/admin/profiles/profile/{self.host_id}/change/")
