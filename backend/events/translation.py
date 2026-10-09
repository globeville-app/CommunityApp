"""
Machine translation for events (docs/LANGUAGE.md, Part B).

Every provider goes through the small Translator interface below. Which
provider to use (Google Cloud Translation or DeepL) is the owner's decision,
so none is switched on: set TRANSLATOR_CLASS in the environment to a class
that implements Translator once one is chosen. Until then the app hides the
"Ver en español" / "See in English" button.

Only an event's title and description are ever sent; nothing about members.
"""

from django.conf import settings
from django.utils.module_loading import import_string


class TranslationUnavailable(Exception):
    """The provider couldn't translate right now."""


class Translator:
    """Implement this for a real provider."""

    def translate(self, text, source, target):
        """Return `text` (in language `source`) translated to `target`."""
        raise NotImplementedError


def get_translator():
    """The configured Translator, or None when no provider is set up."""
    path = settings.TRANSLATOR_CLASS
    return import_string(path)() if path else None
