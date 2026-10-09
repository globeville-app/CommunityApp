"""Test helpers. Tests never call Partiful or a real translation service."""


class FakeTranslator:
    """Marks text instead of translating it, and counts calls."""

    calls = 0

    def translate(self, text, source, target):
        FakeTranslator.calls += 1
        return f"[{source}->{target}] {text}"


class BrokenTranslator:
    def translate(self, text, source, target):
        from events.translation import TranslationUnavailable

        raise TranslationUnavailable()
