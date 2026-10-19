"""Shared setup: members, events and organizations."""

from badges.tests.helpers import BadgeTestCase
from organizations.models import Organization, OrganizationAdmin


class OrgTestCase(BadgeTestCase):
    def setUp(self):
        super().setUp()
        self.globeville = self.highland.__class__.objects.create(id=7, name="Elyria Swansea", source_version="t")
        self.admin_user = self.member("rosa", self.hale)  # admins can live anywhere

    def org(self, name="Our Lady Church", type="faith", neighborhoods=None, status="approved", admins=None):
        organization = Organization.objects.create(name=name, type=type, status=status, description="Every Sunday.")
        organization.neighborhoods.set(neighborhoods or [self.highland, self.globeville])
        for user in admins if admins is not None else [self.admin_user]:
            OrganizationAdmin.objects.create(organization=organization, user=user)
        return organization

    def org_event(self, organization, **extra):
        return self.event(host=self.admin_user, organization=organization, **extra)

    def body(self, **overrides):
        return {
            "name": "Highland Rec Club",
            "type": "club",
            "neighborhoods": [self.highland.pk],
            "description": "Pickup games and more.",
            "link": "https://example.org",
            **overrides,
        }
