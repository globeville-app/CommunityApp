"""The team's admin screens follow the same rules as the app (review P12)."""

from django.contrib import admin
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import RequestFactory
from rest_framework.authtoken.models import TokenProxy

from organizations.admin import AdminsInline, NeighborhoodsInline
from organizations.models import Follow, Organization
from organizations.tests.helpers import OrgTestCase


class AdminRulesTests(OrgTestCase):
    def setUp(self):
        super().setUp()
        self.staff = get_user_model().objects.create_superuser(username="team@example.com", password="x")
        self.client.force_login(self.staff)
        self.organization = self.org()

    def inline_formset(self, inline_class, rows, field):
        request = RequestFactory().post("/")
        request.user = self.staff
        inline = inline_class(Organization, admin.site)
        FormSet = inline.get_formset(request, self.organization)
        prefix = FormSet.get_default_prefix()
        data = {f"{prefix}-TOTAL_FORMS": str(len(rows)), f"{prefix}-INITIAL_FORMS": "0"}
        for i, value in enumerate(rows):
            data[f"{prefix}-{i}-{field}"] = str(value)
        return FormSet(data, instance=Organization(name="New", type="club"), prefix=prefix)

    def test_events_cant_be_deleted_in_admin(self):
        event = self.event(host=self.ana)
        response = self.client.get(f"/admin/events/event/{event.pk}/delete/")
        self.assertEqual(response.status_code, 403)

    def test_at_most_five_admins(self):
        users = [self.member(f"m{i}", self.highland) for i in range(6)]
        self.assertFalse(self.inline_formset(AdminsInline, [u.pk for u in users], "user").is_valid())
        self.assertTrue(self.inline_formset(AdminsInline, [u.pk for u in users[:5]], "user").is_valid())

    def test_at_least_one_neighborhood(self):
        self.assertFalse(self.inline_formset(NeighborhoodsInline, [], "neighborhood").is_valid())
        self.assertTrue(self.inline_formset(NeighborhoodsInline, [self.highland.pk], "neighborhood").is_valid())

    def test_link_must_be_https(self):
        self.organization.link = "http://example.org"
        with self.assertRaises(ValidationError):
            self.organization.full_clean()
        self.organization.link = "https://example.org"
        self.organization.full_clean()

    def test_follows_never_show_the_member(self):
        follow = Follow.objects.create(user=self.ana, organization=self.organization)
        page = self.client.get(f"/admin/organizations/follow/{follow.pk}/change/")
        self.assertEqual(page.status_code, 200)
        self.assertNotContains(page, self.ana.username)
        self.assertNotContains(page, "Ana")

    def test_members_login_tokens_arent_listed(self):
        self.assertFalse(admin.site.is_registered(TokenProxy))
