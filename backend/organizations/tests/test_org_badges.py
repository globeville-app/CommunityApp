"""Organization badges and impact (docs/MILESTONE_4.md, Organization badges)."""

from badges import engine
from badges.models import BadgeState, Keepsake
from organizations.models import OrganizationAdmin
from organizations.tests.helpers import OrgTestCase


class OrgBadgeTests(OrgTestCase):
    def org_state(self, organization, key):
        state = BadgeState.objects.filter(organization=organization, badge_key=key).first()
        return (state.stage, state.count) if state else (0, 0)

    def test_credits_the_organization_never_the_posting_admin(self):
        organization = self.org()
        event = self.org_event(organization, category="cleanup")
        for person in self.members(2):
            self.attend(person, event)
        self.assertEqual(self.org_state(organization, "host"), (1, 2))
        self.assertEqual(self.org_state(organization, "clean_sweeper"), (1, 1))
        self.assertEqual(self.org_state(organization, "helping_hand"), (1, 1))
        for key in ("host", "clean_sweeper", "helping_hand"):
            self.assertEqual(self.state(self.admin_user, key), (0, 0))
        self.assertEqual(engine.impact(self.admin_user), {})

    def test_counts_only_with_two_attendees(self):
        organization = self.org()
        event = self.org_event(organization)
        self.attend(self.ana, event)
        self.assertEqual(self.org_state(organization, "host"), (0, 0))
        event.refresh_from_db()
        self.assertIsNone(event.counted_hosted_at)

    def test_open_door_for_an_admin_written_version(self):
        organization = self.org()
        event = self.org_event(organization, title_alt="Comida de la parroquia")
        for person in self.members(2):
            self.attend(person, event)
        self.assertTrue(Keepsake.objects.filter(organization=organization, badge_key="open_door").exists())
        self.assertFalse(Keepsake.objects.filter(user=self.admin_user).exists())

    def test_no_attendance_badges_for_organizations(self):
        organization = self.org()
        event = self.org_event(organization)
        for person in self.members(2):
            self.attend(person, event)
        keys = set(BadgeState.objects.filter(organization=organization).values_list("badge_key", flat=True))
        self.assertFalse(keys & {"local", "best_guest", "day_one"})

    def test_admins_cant_collect_at_their_own_organizations_events(self):
        from badges.tests.helpers import BadgeTestCase  # noqa: F401
        from config.errors import ApiError

        organization = self.org()
        helper = self.member("helper")
        OrganizationAdmin.objects.create(organization=organization, user=helper)
        event = self.org_event(organization)
        for admin in (self.admin_user, helper):
            with self.assertRaises(ApiError) as caught:
                self.attend(admin, event)
            self.assertEqual(caught.exception.get_codes(), "is_host")

    def test_best_guest_counts_an_organization_as_one_host(self):
        church = self.org()
        club = self.org(name="Rec Club", admins=[self.member("clubadmin")])
        for organization in (church, church, club):
            self.attend(self.ana, self.org_event(organization))
        self.attend(self.ana, self.event())  # a member's own event: one more host
        self.assertEqual(self.state(self.ana, "best_guest"), (1, 3))  # church, club, host

    def test_day_one_counts_an_organizations_first_counted_event(self):
        organization = self.org()
        event = self.org_event(organization)
        early, late = self.members(2, prefix="d")
        self.attend(early, event)
        self.attend(late, event)
        for person in (early, late):
            self.assertEqual(self.state(person, "day_one"), (1, 1))
        # The posting admin's own first counted event is still to come.
        own = self.event(host=self.admin_user)
        for person in self.members(2, prefix="o"):
            self.attend(person, own)
        own.refresh_from_db()
        self.assertTrue(own.is_hosts_first_counted)

    def test_member_badges_unchanged_without_an_organization(self):
        event = self.event(category="cleanup")
        for person in self.members(2):
            self.attend(person, event)
        self.assertEqual(self.state(self.host, "host"), (1, 2))
        self.assertEqual(self.state(self.host, "clean_sweeper"), (1, 1))

    def test_impact_screen_for_admins_only(self):
        organization = self.org()
        event = self.org_event(organization, title="Parish potluck")
        for person in self.members(3):
            self.attend(person, event)
        data = self.api(self.admin_user).get(f"/api/organizations/{organization.pk}/impact").data
        self.assertEqual(data["impact"]["brought_together"], 3)
        self.assertEqual(data["impact"]["most_popular"]["title"], "Parish potluck")
        self.assertEqual({b["key"] for b in data["badges"]}, {"host", "fiestero", "treasure_hunter", "aficionado", "recreationist", "helping_hand", "clean_sweeper", "civic_voice", "open_door"})
        self.assertNotIn("n0", str(data))
        self.assertEqual(self.api(self.ana).get(f"/api/organizations/{organization.pk}/impact").data["code"], "not_org_admin")
        page = self.api(self.ana).get(f"/api/organizations/{organization.pk}").data
        self.assertEqual([b["key"] for b in page["badges"]], ["host", "fiestero"])

    def test_collect_cards_skip_your_own_organizations_events(self):
        from datetime import timedelta

        from django.utils import timezone

        from events.models import Going

        organization = self.org()
        event = self.org_event(organization, starts=timezone.now() - timedelta(days=1))
        Going.objects.create(user=self.admin_user, event=event)
        self.assertEqual(engine.collect_events(self.admin_user), [])
