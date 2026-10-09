"""The category list, the config endpoint, and the language files agree."""

import json

from django.conf import settings
from django.test import SimpleTestCase
from rest_framework.test import APITestCase

from events.categories import (
    ALL_CATEGORY_KEYS,
    CATEGORY_KEYS,
    GROUP_KEYS,
    GROUPS,
    OTHER,
    group_of,
    suggest_category,
)


class ConfigTests(APITestCase):
    def test_config_lists_every_group_and_category(self):
        data = self.client.get("/api/config").data
        self.assertEqual(
            [(g["key"], g["categories"]) for g in data["category_groups"]],
            [(group, keys) for group, keys in GROUPS],
        )
        self.assertEqual(data["other_category"], "other")
        self.assertEqual(data["max_interests"], 8)
        self.assertNotIn("interests", data)  # the Milestone 1 list is retired


class LanguageFileTests(SimpleTestCase):
    """Shared check: every key the server knows has words in both app languages."""

    def test_every_key_has_english_and_spanish_labels_and_hints(self):
        for path in settings.LANGUAGE_FILES:
            with open(path, encoding="utf-8") as f:
                strings = json.load(f)
            with self.subTest(file=path.name):
                for key in ALL_CATEGORY_KEYS:
                    self.assertTrue(strings["categories"].get(key, "").strip(), key)
                for key in CATEGORY_KEYS:
                    self.assertTrue(strings["category_hints"].get(key, "").strip(), key)
                for key in GROUP_KEYS:
                    self.assertTrue(strings["category_groups"].get(key, "").strip(), key)


class CategoryListTests(SimpleTestCase):
    def test_keys_are_unique_and_other_is_separate(self):
        self.assertEqual(len(CATEGORY_KEYS), len(set(CATEGORY_KEYS)))
        self.assertNotIn(OTHER, CATEGORY_KEYS)
        self.assertEqual(group_of("potluck"), "celebrate")
        self.assertIsNone(group_of(OTHER))


class SuggestionTests(SimpleTestCase):
    def test_matches_words_in_either_language(self):
        cases = {
            "Fall Potluck on Lincoln St": "potluck",
            "Limpieza del río": "cleanup",
            "Gran limpieza del callejón": "cleanup",
            "Noche de LOTERÍA": "game_night",
            "Farmers Market Saturday": "market",
            "Trivia at the rec center": "game_night",
            "Toy drive for the holidays": "donation_drive",
            "Tianguis de otoño": "market",
        }
        for title, expected in cases.items():
            with self.subTest(title=title):
                self.assertEqual(suggest_category(title), expected)

    def test_no_match_means_no_suggestion(self):
        self.assertIsNone(suggest_category("Saturday at Ana's"))
        self.assertIsNone(suggest_category(""))
        # Whole words only: "marketing" isn't a market.
        self.assertIsNone(suggest_category("Marketing tips"))
