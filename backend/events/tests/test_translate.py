"""Event translation (docs/LANGUAGE.md Part B), always with a fake translator."""

from django.test import override_settings

from events.models import TranslationCache
from events.testing import FakeTranslator
from events.tests.helpers import EventTestCase

FAKE = "events.testing.FakeTranslator"


class TranslateTests(EventTestCase):
    def setUp(self):
        super().setUp()
        FakeTranslator.calls = 0
        # Ana writes in Spanish.
        self.event_id = self.post_event(title="Limpieza del río", description="Traigan guantes.").data["id"]
        self.as_user(self.ben)

    def translate(self, target="en"):
        return self.client.post(f"/api/events/{self.event_id}/translate", {"target": target}, format="json")

    def test_no_provider_configured_returns_a_code(self):
        response = self.translate()
        self.assertEqual((response.status_code, response.data), (503, {"code": "translation_unavailable"}))

    @override_settings(TRANSLATOR_CLASS=FAKE)
    def test_translates_and_caches(self):
        first = self.translate().data
        self.assertEqual(first["title"], "[es->en] Limpieza del río")
        self.assertEqual(first["description"], "[es->en] Traigan guantes.")
        self.assertTrue(first["machine"])
        self.assertEqual(FakeTranslator.calls, 2)
        self.assertEqual(self.translate().data, first)
        self.assertEqual(FakeTranslator.calls, 2)  # served from the cache
        self.assertEqual(TranslationCache.objects.count(), 2)

    @override_settings(TRANSLATOR_CLASS=FAKE)
    def test_editing_clears_the_cache(self):
        self.translate()
        self.as_user(self.ana)
        self.client.patch(f"/api/events/{self.event_id}", {"title": "Gran limpieza"}, format="json")
        self.assertFalse(TranslationCache.objects.exists())
        self.as_user(self.ben)
        self.assertEqual(self.translate().data["title"], "[es->en] Gran limpieza")

    @override_settings(TRANSLATOR_CLASS=FAKE)
    def test_the_organizers_own_version_wins(self):
        self.as_user(self.ana)
        self.client.patch(f"/api/events/{self.event_id}", {"title_alt": "River cleanup"}, format="json")
        self.as_user(self.ben)
        data = self.translate().data
        self.assertEqual((data["title"], data["machine"]), ("River cleanup", False))
        self.assertEqual(FakeTranslator.calls, 0)

    @override_settings(TRANSLATOR_CLASS="events.testing.BrokenTranslator")
    def test_provider_failure_returns_a_code(self):
        self.assertEqual(self.translate().data, {"code": "translation_failed"})
        self.assertEqual(self.translate(target="fr").data, {"code": "invalid_language"})

    @override_settings(TRANSLATOR_CLASS=FAKE)
    def test_only_event_text_is_sent(self):
        sent = []
        original = FakeTranslator.translate

        def spy(self_, text, source, target):
            sent.append(text)
            return original(self_, text, source, target)

        FakeTranslator.translate = spy
        try:
            self.translate()
        finally:
            FakeTranslator.translate = original
        self.assertEqual(sent, ["Limpieza del río", "Traigan guantes."])
