"""Organizations: requests, approval, visibility, admins, follows, posting (docs/MILESTONE_4.md)."""

from datetime import timedelta

from django.contrib.admin.sites import AdminSite
from django.test import RequestFactory
from django.utils import timezone

from events.models import Event
from organizations.admin import apply_change
from organizations.models import Follow, Organization, OrganizationAdmin, OrganizationChangeRequest
from organizations.tests.helpers import OrgTestCase
from profiles.models import Profile

FUTURE = (timezone.localtime() + timedelta(days=5)).strftime("%Y-%m-%dT18:00")


class RequestAndApprovalTests(OrgTestCase):
    def test_a_request_is_pending_and_invisible_to_others(self):
        response = self.api(self.ana).post("/api/organizations", self.body(), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual((response.data["status"], response.data["is_admin"]), ("pending", True))
        org_id = response.data["id"]
        self.assertTrue(OrganizationAdmin.objects.filter(organization_id=org_id, user=self.ana).exists())
        neighbor = self.member("ben")
        self.assertEqual(self.api(neighbor).get(f"/api/organizations/{org_id}").status_code, 404)
        self.assertEqual(self.api(neighbor).get("/api/organizations").data["organizations"], [])
        # The asker still sees it, with its status.
        mine = self.api(self.ana).get("/api/me/organizations").data["organizations"]
        self.assertEqual([(o["name"], o["status"]) for o in mine], [("Highland Rec Club", "pending")])

    def test_checks_the_form(self):
        client = self.api(self.ana)
        cases = [
            ({"name": ""}, "org_name_required"),
            ({"name": "x" * 61}, "org_name_too_long"),
            ({"type": "church"}, "invalid_org_type"),
            ({"neighborhoods": []}, "neighborhoods_required"),
            ({"neighborhoods": [999]}, "invalid_neighborhood"),
            ({"neighborhoods": [True]}, "invalid_neighborhood"),
            ({"description": "x" * 501}, "org_description_too_long"),
            ({"link": "http://example.org"}, "invalid_link"),
            ({"type": "business"}, "business_rule"),
        ]
        for overrides, code in cases:
            with self.subTest(code=code):
                self.assertEqual(client.post("/api/organizations", self.body(**overrides), format="json").data["code"], code)
        ok = client.post("/api/organizations", self.body(type="business", business_rule_accepted=True), format="json")
        self.assertEqual(ok.status_code, 201)

    def test_approval_shows_it_in_its_neighborhoods_only(self):
        organization = self.org(neighborhoods=[self.highland])
        self.assertEqual(self.api(self.ana).get(f"/api/organizations/{organization.pk}").status_code, 200)
        listed = self.api(self.ana).get("/api/organizations").data["organizations"]
        self.assertEqual([o["name"] for o in listed], ["Our Lady Church"])
        outsider = self.member("out", self.globeville)
        self.assertEqual(self.api(outsider).get(f"/api/organizations/{organization.pk}").status_code, 404)
        self.assertEqual(self.api(outsider).get("/api/organizations").data["organizations"], [])

    def test_name_type_and_neighborhood_edits_wait_for_approval(self):
        organization = self.org()
        client = self.api(self.admin_user)
        response = client.patch(
            f"/api/organizations/{organization.pk}",
            {"name": "Our Lady of Mount Carmel", "description": "Mass and potlucks.", "neighborhoods": [self.highland.pk]},
            format="json",
        )
        self.assertTrue(response.data["change_pending"])
        self.assertEqual(response.data["name"], "Our Lady Church")  # not yet
        self.assertEqual(response.data["description"], "Mass and potlucks.")  # right away
        change = OrganizationChangeRequest.objects.get()
        apply_change(change)
        organization.refresh_from_db()
        self.assertEqual(organization.name, "Our Lady of Mount Carmel")
        self.assertEqual(list(organization.neighborhoods.values_list("pk", flat=True)), [self.highland.pk])

    def test_members_cant_edit(self):
        organization = self.org()
        response = self.api(self.ana).patch(f"/api/organizations/{organization.pk}", {"description": "x"}, format="json")
        self.assertEqual(response.data["code"], "not_org_admin")

    def test_admin_approve_action_needs_an_admin(self):
        from organizations.admin import OrganizationModelAdmin

        hidden = self.org(status="hidden", admins=[])
        model_admin = OrganizationModelAdmin(Organization, AdminSite())
        request = RequestFactory().get("/")
        request._messages = type("M", (), {"add": lambda *a, **k: None})()
        model_admin.approve(request, Organization.objects.filter(pk=hidden.pk))
        hidden.refresh_from_db()
        self.assertEqual(hidden.status, "hidden")
        OrganizationAdmin.objects.create(organization=hidden, user=self.ana)
        model_admin.approve(request, Organization.objects.filter(pk=hidden.pk))
        hidden.refresh_from_db()
        self.assertEqual(hidden.status, "approved")


class AdminTests(OrgTestCase):
    def test_one_to_five_admins_by_invitation(self):
        organization = self.org()
        client = self.api(self.admin_user)
        url = f"/api/organizations/{organization.pk}/admins"
        # Unknown emails get the same answer, and nothing is created.
        unknown = client.post(url, {"email": "nobody@example.com"}, format="json")
        self.assertEqual(unknown.status_code, 202)
        self.assertEqual(unknown.data["pending_invites"], 0)
        helpers = [self.member(f"helper{i}") for i in range(4)]
        for helper in helpers:
            response = client.post(url, {"email": helper.username}, format="json")
            self.assertEqual(response.status_code, 202)
            self.assertNotIn("Helper", str(response.data))  # who was invited stays private
        self.assertEqual(organization.admins.count(), 1)
        self.member("sixth")
        self.assertEqual(client.post(url, {"email": "sixth@example.com"}, format="json").data["code"], "too_many_admins")

        # The invited member accepts or declines.
        helper = self.api(helpers[0])
        invites = helper.get("/api/me/organization-invites").data["invites"]
        self.assertEqual(invites[0]["organization"]["name"], "Our Lady Church")
        self.assertEqual(helper.put(f"/api/me/organization-invites/{invites[0]['id']}").status_code, 204)
        self.assertTrue(organization.is_admin(helpers[0]))
        declined = self.api(helpers[1]).get("/api/me/organization-invites").data["invites"][0]["id"]
        self.assertEqual(self.api(helpers[1]).delete(f"/api/me/organization-invites/{declined}").status_code, 204)
        self.assertEqual(self.api(helpers[2]).delete(f"/api/me/organization-invites/{declined}").status_code, 404)

        # Admins can cancel the rest.
        self.assertEqual(client.delete(f"/api/organizations/{organization.pk}/invites").data["pending_invites"], 0)

    def test_only_approved_organizations_invite(self):
        organization = self.org(status="pending")
        self.member("helper")
        response = self.api(self.admin_user).post(
            f"/api/organizations/{organization.pk}/admins", {"email": "helper@example.com"}, format="json"
        )
        self.assertEqual(response.data["code"], "org_not_approved")

    def test_the_last_admin_cant_leave(self):
        organization = self.org()
        me = Profile.objects.get(user=self.admin_user).pk
        response = self.api(self.admin_user).delete(f"/api/organizations/{organization.pk}/admins", {"member_id": me}, format="json")
        self.assertEqual(response.data["code"], "last_admin")

    def test_deleting_the_last_admins_account_hides_it_and_keeps_its_events(self):
        from django.contrib.auth.hashers import make_password

        organization = self.org()
        event = self.org_event(organization, starts=timezone.now() + timedelta(days=3))
        type(self.admin_user).objects.filter(pk=self.admin_user.pk).update(password=make_password("pw"))
        self.api(self.admin_user).post("/api/account/delete", {"password": "pw"}, format="json")
        organization.refresh_from_db()
        event.refresh_from_db()
        self.assertEqual(organization.status, "hidden")
        self.assertEqual(event.status, "active")  # not cancelled: it belongs to the organization
        self.assertEqual(self.api(self.ana).get(f"/api/organizations/{organization.pk}").status_code, 404)
        detail = self.api(self.ana).get(f"/api/events/{event.pk}").data
        self.assertEqual(detail["organization"]["name"], "Our Lady Church")
        self.assertFalse(detail["organization"]["has_page"])

    def test_a_request_still_waiting_for_review_keeps_waiting(self):
        # Hidden means "approved, but nobody runs it": Approve then shows it
        # again. A pending request must not skip review that way (review G4).
        from django.contrib.auth.hashers import make_password

        organization = self.org(status="pending")
        type(self.admin_user).objects.filter(pk=self.admin_user.pk).update(password=make_password("pw"))
        self.api(self.admin_user).post("/api/account/delete", {"password": "pw"}, format="json")
        organization.refresh_from_db()
        self.assertEqual(organization.status, "pending")

    def test_another_admin_keeps_it_live(self):
        from django.contrib.auth.hashers import make_password

        organization = self.org(admins=[self.admin_user, self.ana])
        type(self.admin_user).objects.filter(pk=self.admin_user.pk).update(password=make_password("pw"))
        self.api(self.admin_user).post("/api/account/delete", {"password": "pw"}, format="json")
        organization.refresh_from_db()
        self.assertEqual(organization.status, "approved")


class PostingAsOrganizationTests(OrgTestCase):
    def event_body(self, organization, neighborhood):
        return {
            "category": "potluck",
            "title": "Parish potluck",
            "starts_at": FUTURE,
            "location_text": "The parish hall",
            "latitude": 39.7615,
            "longitude": -105.0112,
            "organization": organization.pk,
            "neighborhood": neighborhood.pk,
        }

    def test_admins_post_to_a_served_neighborhood_and_the_poster_stays_hidden(self):
        organization = self.org()
        response = self.api(self.admin_user).post("/api/events", self.event_body(organization, self.globeville), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        event = Event.objects.get()
        self.assertEqual((event.neighborhood, event.organization, event.organizer), (self.globeville, organization, self.admin_user))
        neighbor = self.member("g1", self.globeville)
        seen = self.api(neighbor).get(f"/api/events/{event.pk}").data
        self.assertEqual(seen["organization"]["name"], "Our Lady Church")
        self.assertIsNone(seen["organizer_name"])
        self.assertIsNone(seen["organizer_member_id"])
        self.assertNotIn("Rosa", str(seen))
        # The admin (who lives in Hale) can still open, edit and cancel it.
        mine = self.api(self.admin_user).get(f"/api/events/{event.pk}").data
        self.assertTrue(mine["is_organizer"])
        other_admin = self.member("other_admin")
        OrganizationAdmin.objects.create(organization=organization, user=other_admin)
        self.assertEqual(self.api(other_admin).post(f"/api/events/{event.pk}/cancel").status_code, 200)

    def test_only_admins_of_approved_organizations(self):
        organization = self.org()
        self.assertEqual(self.api(self.ana).post("/api/events", self.event_body(organization, self.highland), format="json").data["code"], "not_org_admin")
        pending = self.org(name="New", status="pending")
        self.assertEqual(self.api(self.admin_user).post("/api/events", self.event_body(pending, self.highland), format="json").data["code"], "org_not_approved")

    def test_the_neighborhood_must_be_served(self):
        organization = self.org(neighborhoods=[self.highland])
        response = self.api(self.admin_user).post("/api/events", self.event_body(organization, self.hale), format="json")
        self.assertEqual(response.data["code"], "neighborhood_not_served")

    def test_members_still_post_in_their_own_neighborhood(self):
        body = self.event_body(self.org(), self.globeville)
        del body["organization"]
        self.api(self.ana).post("/api/events", body, format="json")
        self.assertEqual(Event.objects.get().neighborhood, self.highland)


class FollowTests(OrgTestCase):
    def test_follow_unfollow_and_the_following_filter(self):
        organization = self.org()
        org_event = self.org_event(organization, starts=timezone.now() + timedelta(days=2))
        self.event(starts=timezone.now() + timedelta(days=3))  # someone else's
        client = self.api(self.ana)
        client.put(f"/api/organizations/{organization.pk}/follow")
        client.put(f"/api/organizations/{organization.pk}/follow")
        self.assertEqual(Follow.objects.count(), 1)  # one per pair
        following = client.get("/api/events?following=true").data["events"]
        self.assertEqual([e["id"] for e in following], [org_event.pk])
        self.assertTrue(following[0]["is_following"])
        self.assertEqual(len(client.get("/api/events").data["events"]), 2)
        client.delete(f"/api/organizations/{organization.pk}/follow")
        self.assertEqual(client.get("/api/events?following=true").data["events"], [])

    def test_the_follower_count_is_only_for_admins(self):
        organization = self.org()
        self.api(self.ana).put(f"/api/organizations/{organization.pk}/follow")
        self.assertNotIn("follower_count", self.api(self.ana).get(f"/api/organizations/{organization.pk}").data)
        self.assertEqual(self.api(self.admin_user).get(f"/api/organizations/{organization.pk}").data["follower_count"], 1)

    def test_page_shows_upcoming_events_in_my_neighborhood_and_a_past_count(self):
        organization = self.org()
        here = self.org_event(organization, starts=timezone.now() + timedelta(days=2), neighborhood=self.highland)
        self.org_event(organization, starts=timezone.now() + timedelta(days=2), neighborhood=self.globeville)
        self.org_event(organization, starts=timezone.now() - timedelta(days=9), neighborhood=self.highland)
        page = self.api(self.ana).get(f"/api/organizations/{organization.pk}").data
        self.assertEqual([e["id"] for e in page["upcoming_events"]], [here.pk])
        self.assertEqual(page["past_event_count"], 1)
        self.assertEqual(len(self.api(self.admin_user).get(f"/api/organizations/{organization.pk}").data["upcoming_events"]), 2)

    def test_report_and_neighborhood_list(self):
        organization = self.org()
        self.assertEqual(self.api(self.ana).post(f"/api/organizations/{organization.pk}/report", {"reason": "Ads"}, format="json").status_code, 201)
        names = [n["name"] for n in self.api(self.ana).get("/api/neighborhoods").data["neighborhoods"]]
        self.assertEqual(names, ["Elyria Swansea", "Hale", "Highland"])
