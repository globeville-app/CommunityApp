"""The owner stats page's Milestone 4 counts."""

from datetime import timedelta

from django.urls import reverse
from django.utils import timezone

from accounts.models import Account
from notifications.models import PushToken, ScheduledNotification
from organizations.models import Follow, OrganizationChangeRequest
from organizations.tests.helpers import OrgTestCase
from stats.numbers import organization_numbers


class OrgStatsTests(OrgTestCase):
    def test_counts(self):
        church = self.org()
        self.org(name="Corner Cafe", type="business", status="pending")
        OrganizationChangeRequest.objects.create(organization=church, name="New name")
        Follow.objects.create(user=self.ana, organization=church)
        now = timezone.now()
        org_event = self.org_event(church, starts=now + timedelta(days=2))
        self.event(starts=now + timedelta(days=3))
        ScheduledNotification.objects.create(user=self.ana, event=org_event, kind="reminder", send_at=now, sent_at=now, delivered=True)
        ScheduledNotification.objects.create(user=self.host, event=org_event, kind="reminder", send_at=now, sent_at=now, delivered=False)
        ScheduledNotification.objects.create(user=self.ana, event=org_event, kind="cancelled", send_at=now, sent_at=now, delivered=True)
        Account.objects.filter(user__in=[self.ana, self.host]).update(last_seen_at=now)
        PushToken.objects.create(user=self.ana, token="ExponentPushToken[a]")

        numbers = organization_numbers(now)
        self.assertEqual(numbers["pending_orgs"], 1)
        self.assertEqual(numbers["pending_changes"], 1)
        self.assertEqual(numbers["follows"], 1)
        self.assertEqual((numbers["events_by_orgs_30"], numbers["events_by_members_30"]), (1, 1))
        self.assertEqual((numbers["reminders_sent_30"], numbers["cancellations_sent_30"]), (1, 1))
        self.assertEqual(numbers["notifications_on_pct"], 50)
        by_type = dict(numbers["by_type"])
        self.assertEqual(by_type["faith"][numbers["statuses"].index("approved")], 1)
        self.assertEqual(by_type["business"][numbers["statuses"].index("pending")], 1)

    def test_page_shows_them_without_names(self):
        self.org()
        from django.contrib.auth import get_user_model

        self.client.force_login(get_user_model().objects.create_superuser(username="boss", password="x"))
        page = self.client.get(reverse("owner-stats")).content.decode()
        self.assertIn("Organizations by type and status", page)
        self.assertIn("of active members with notifications on", page)
        self.assertNotIn("Rosa", page)
