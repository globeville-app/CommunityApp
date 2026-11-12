"""The team hears about every report and organization request by email, not only problem reports."""

from unittest import mock

from django.core import mail
from django.test import override_settings

from events.tests.helpers import EventTestCase


@override_settings(OWNER_ALERT_EMAILS=["team@example.org"], PROBLEM_REPORT_EMAILS=[])
class TeamAlertTests(EventTestCase):
    def setUp(self):
        super().setUp()
        self.event = self.make_event(self.ana, title="Fall potluck")
        self.as_user(self.ben)

    def only_email(self):
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.to, ["team@example.org"])
        self.assertIn("Open in admin: http", message.body)
        return message

    def test_an_event_report(self):
        self.client.post(f"/api/events/{self.event.pk}/report", {"reason": "Looks like spam"}, format="json")
        message = self.only_email()
        self.assertIn("event reported: Fall potluck", message.subject)
        self.assertIn("Looks like spam", message.body)

    def test_a_member_report(self):
        self.client.post(f"/api/members/{self.ana.profile.pk}/report", {"reason": "Rude"}, format="json")
        self.assertIn("member reported", self.only_email().subject)

    def test_an_organization_request(self):
        response = self.client.post(
            "/api/organizations",
            {"name": "Swansea Garden Club", "type": "club", "description": "We grow things.", "neighborhoods": [3]},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIn("new organization to review: Swansea Garden Club", self.only_email().subject)

    def test_a_failing_email_never_fails_the_report(self):
        with mock.patch("support.notify.send_mail", side_effect=OSError("smtp down")):
            response = self.client.post(f"/api/events/{self.event.pk}/report", {"reason": "Spam"}, format="json")
        self.assertEqual(response.status_code, 201)

    @override_settings(OWNER_ALERT_EMAILS=[], PROBLEM_REPORT_EMAILS=[])
    def test_nobody_configured_sends_nothing(self):
        self.client.post(f"/api/events/{self.event.pk}/report", {"reason": "Spam"}, format="json")
        self.assertEqual(mail.outbox, [])
