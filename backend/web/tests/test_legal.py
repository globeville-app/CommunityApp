"""The privacy policy, terms and account-deletion pages (web/legal.py)."""

import json

from django.conf import settings
from django.test import SimpleTestCase, override_settings

from config.settings import REPO_ROOT

FILLED = {
    "operator": "Neighbors LLC",
    "contact_email": "privacy@example.org",
    "mailing_address": "PO Box 1, Denver, CO 80205",
    "effective_date": "January 5, 2027",
    "minimum_age": 13,
    "governing_state": "Colorado",
}


class LegalPageTests(SimpleTestCase):
    def test_each_page_in_english_and_spanish(self):
        pages = {
            "/privacy": ("Privacy Policy", "Política de privacidad"),
            "/terms": ("Terms of Use", "Términos de uso"),
            "/delete-account": ("Delete account", "Eliminar cuenta"),
        }
        for url, (english, spanish) in pages.items():
            with self.subTest(url=url):
                self.assertContains(self.client.get(f"{url}?lang=en"), english)
                self.assertContains(self.client.get(f"{url}?lang=es"), spanish)

    def test_the_privacy_promises_the_app_keeps(self):
        page = self.client.get("/privacy?lang=en")
        for promise in [
            "We never store your home address",
            "No ads, no tracking, no selling",
            "We never read your contacts",
            "never where you are",
            "U.S. Census Bureau",
            "1 year after the event",
        ]:
            self.assertContains(page, promise)
        self.assertContains(self.client.get("/privacy?lang=es"), "Nunca guardamos tu dirección")

    def test_terms_cover_what_app_review_asks_for(self):
        page = self.client.get("/terms?lang=en")
        self.assertContains(page, "zero tolerance for objectionable content")
        self.assertContains(page, "report an event, an organization or a member")
        self.assertContains(page, f"at least {settings.LEGAL['minimum_age']} years old")

    def test_a_draft_says_so_until_the_owner_fills_in_the_facts(self):
        with override_settings(LEGAL={**FILLED, "operator": ""}):
            page = self.client.get("/privacy?lang=en")
            self.assertContains(page, "Draft: not yet in effect")
            self.assertContains(page, "[to be filled in]")
            self.assertContains(self.client.get("/privacy?lang=es"), "[por completar]")
        with override_settings(LEGAL=FILLED):
            page = self.client.get("/privacy?lang=en")
            self.assertNotContains(page, "Draft")
            self.assertNotContains(page, "[to be filled in]")
            self.assertContains(page, "Neighbors LLC")
            self.assertContains(page, "mailto:privacy@example.org")
            self.assertContains(page, "January 5, 2027")

    def test_the_app_links_to_these_pages(self):
        shared = json.loads((REPO_ROOT / "shared" / "app_config.json").read_text())
        base = shared["invite_url"].rstrip("/")
        self.assertEqual(shared["privacy_url"], f"{base}/privacy")
        self.assertEqual(shared["terms_url"], f"{base}/terms")

    def test_every_web_page_links_to_them(self):
        page = self.client.get("/")
        self.assertContains(page, 'href="/privacy"')
        self.assertContains(page, 'href="/terms"')
