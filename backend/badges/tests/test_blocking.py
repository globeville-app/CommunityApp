"""Block this member: the blocker stops seeing their events (review P6)."""

from datetime import timedelta

from django.utils import timezone

from badges.tests.helpers import BadgeTestCase
from organizations.models import Organization, OrganizationAdmin
from profiles.models import Block, Profile


class BlockingTests(BadgeTestCase):
    def setUp(self):
        super().setUp()
        self.ben = self.member("ben")
        self.host_id = Profile.objects.get(user=self.host).pk
        soon = timezone.now() + timedelta(days=2)
        self.upcoming = self.event(starts=soon)

    def block(self, client, member_id=None):
        return client.put(f"/api/members/{member_id or self.host_id}/block")

    def listed(self, user):
        return [e["id"] for e in self.api(user).get("/api/events").data["events"]]

    def test_blocked_members_events_disappear_for_the_blocker_only(self):
        ana = self.api(self.ana)
        self.assertEqual(self.block(ana).data, {"is_blocked": True})
        self.assertEqual(self.listed(self.ana), [])
        self.assertEqual(ana.get(f"/api/events/{self.upcoming.pk}").status_code, 404)
        self.assertEqual(self.listed(self.ben), [self.upcoming.pk])  # nothing changes for others
        self.assertTrue(ana.get(f"/api/members/{self.host_id}").data["is_blocked"])

        self.assertEqual(ana.delete(f"/api/members/{self.host_id}/block").data, {"is_blocked": False})
        self.assertEqual(self.listed(self.ana), [self.upcoming.pk])

    def test_organization_events_they_posted_still_show(self):
        organization = Organization.objects.create(name="Rec Club", type="club", status="approved")
        organization.neighborhoods.set([self.highland])
        OrganizationAdmin.objects.create(organization=organization, user=self.host)
        org_event = self.event(starts=timezone.now() + timedelta(days=3), organization=organization)
        self.block(self.api(self.ana))
        self.assertEqual(self.listed(self.ana), [org_event.pk])

    def test_the_settings_list_and_its_limits(self):
        ana = self.api(self.ana)
        self.block(ana)
        self.block(ana)  # twice is fine
        self.assertEqual(ana.get("/api/me/blocks").data, {"members": [{"id": self.host_id, "display_name": "Host R."}]})
        self.assertEqual(Block.objects.count(), 1)

        me = Profile.objects.get(user=self.ana).pk
        self.assertEqual(self.block(ana, me).data, {"code": "cant_block_yourself"})
        outsider = Profile.objects.get(user=self.member("out", self.hale)).pk
        self.assertEqual(self.block(ana, outsider).status_code, 404)
