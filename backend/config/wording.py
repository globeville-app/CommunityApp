"""
Words the server sends out itself (push text, the invite message, text
messages), in the member's language. They live in the app's language files
(mobile/src/i18n/en.json and es.json), so every word members see is in one
place for the Spanish reviewer. Server-side sections use {single_braces}.
"""

import json
from functools import lru_cache
from pathlib import Path

from django.conf import settings


@lru_cache(maxsize=1)
def _files():
    files = {}
    for path in settings.LANGUAGE_FILES:
        with open(path, encoding="utf-8") as f:
            files[Path(path).stem] = json.load(f)
    return files


def words(section, language):
    """The {key: text} of one section of the language file, e.g. words("invite", "es")."""
    files = _files()
    return files.get(language, files["en"])[section]
