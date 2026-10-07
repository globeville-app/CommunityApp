"""
The app name may only be written in shared/app_config.json. Everything else
reads it from there, so renaming the app is a one-line change.
"""

import json

from django.conf import settings
from django.test import SimpleTestCase

SKIP_DIRS = {"node_modules", ".venv", "__pycache__", ".expo", ".git", "media", "dist", "coverage"}
SKIP_FILES = {"package-lock.json", "yarn.lock", "db.sqlite3"}
SKIP_SUFFIXES = {".md", ".geojson", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".ttf", ".pyc", ".sqlite3"}


def app_name_from_shared_config():
    with open(settings.REPO_ROOT / "shared" / "app_config.json", encoding="utf-8") as f:
        return json.load(f)["app_name"]


def files_to_check():
    for folder in ("backend", "mobile"):
        root = settings.REPO_ROOT / folder
        for path in root.rglob("*"):
            relative_parts = path.relative_to(root).parts
            if any(part in SKIP_DIRS for part in relative_parts):
                continue
            if path.is_file() and path.name not in SKIP_FILES and path.suffix.lower() not in SKIP_SUFFIXES:
                yield path


class AppNameTests(SimpleTestCase):
    def test_settings_read_the_shared_config(self):
        self.assertEqual(settings.APP_NAME, app_name_from_shared_config())

    def test_name_is_not_hard_coded_in_backend_or_mobile(self):
        name = app_name_from_shared_config()
        offenders = []
        checked = 0
        for path in files_to_check():
            checked += 1
            if name in path.read_text(encoding="utf-8", errors="ignore"):
                offenders.append(str(path.relative_to(settings.REPO_ROOT)))
        self.assertGreater(checked, 20)  # make sure we actually looked
        self.assertEqual(offenders, [], f'"{name}" is hard-coded; read it from shared/app_config.json')
