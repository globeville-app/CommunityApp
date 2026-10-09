"""
The event categories (docs/MILESTONE_2.md), defined once, here.

Categories are stored as stable keys ("block_party"), never as display text,
so labels can change without breaking past events. The words people see, and
the search hints, live in the app's language files:
mobile/src/i18n/en.json and es.json, under "categories", "category_groups"
and "category_hints". GET /api/config sends this list to the app.

Interests use the same keys (except "other"). Adding a category here makes
it an event category and an interest at once.
"""

import json
import re
import unicodedata
from functools import lru_cache

from django.conf import settings

# (group key, [category keys]), in the order the app shows them.
GROUPS = [
    ("celebrate", ["block_party", "potluck", "festival", "parade", "cultural_celebration", "pool_party"]),
    ("buy_swap", ["market", "pop_up", "yard_sale", "swap"]),
    ("entertainment", ["live_music", "comedy", "arts_crafts", "movie_night", "game_night", "watch_party"]),
    ("get_active", ["pickup_game", "fitness", "gardening", "pet_meetup"]),
    ("community", ["cleanup", "volunteering", "donation_drive", "fundraiser", "community_meeting", "resource_fair"]),
    ("learn_connect", ["workshop", "networking", "expo", "meet_greet", "seniors"]),
]

# Shown at the bottom of every group. Needs a short write-in, and can't be
# chosen as an interest.
OTHER = "other"
OTHER_MAX_LENGTH = 40

MAX_INTERESTS = 8

GROUP_KEYS = [group for group, _ in GROUPS]
CATEGORY_KEYS = [key for _, keys in GROUPS for key in keys]
ALL_CATEGORY_KEYS = CATEGORY_KEYS + [OTHER]
INTEREST_KEYS = CATEGORY_KEYS  # every category except "other"

_GROUP_OF = {key: group for group, keys in GROUPS for key in keys}


def group_of(category):
    """The group a category belongs to, or None for "other"."""
    return _GROUP_OF.get(category)


def config_json():
    """The list as GET /api/config sends it."""
    return {
        "category_groups": [{"key": group, "categories": keys} for group, keys in GROUPS],
        "other_category": OTHER,
        "other_max_length": OTHER_MAX_LENGTH,
        "max_interests": MAX_INTERESTS,
    }


# ---- Category suggestion (for Partiful titles) -------------------------------


def _normalize(text):
    """Lowercase, without accents, so "Lotería" matches "loteria"."""
    text = unicodedata.normalize("NFKD", text.lower())
    return "".join(ch for ch in text if not unicodedata.combining(ch))


@lru_cache(maxsize=1)
def search_terms():
    """
    {category: [words and phrases]} from both language files: each label plus
    its comma-separated hints. Read from the app's files so there's one list.
    """
    terms = {key: [] for key in CATEGORY_KEYS}
    for path in settings.LANGUAGE_FILES:
        with open(path, encoding="utf-8") as f:
            strings = json.load(f)
        for key in CATEGORY_KEYS:
            label = strings.get("categories", {}).get(key, "")
            hints = strings.get("category_hints", {}).get(key, "")
            for term in re.split(r"[,/]", f"{label},{hints}"):
                term = _normalize(term).strip()
                if term and term not in terms[key]:
                    terms[key].append(term)
    return terms


def suggest_category(title):
    """
    The first category whose label or hint appears in the title as whole
    words, or None. Simple keyword matching, on purpose: no AI, no outside
    service. The organizer can always pick something else.
    """
    text = f" {re.sub(r'[^a-z0-9]+', ' ', _normalize(title or ''))} "
    for key, terms in search_terms().items():
        for term in terms:
            words = re.sub(r"[^a-z0-9]+", " ", term).strip()
            if words and f" {words} " in text:
                return key
    return None
