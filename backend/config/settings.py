"""
Django settings for the backend.

This file is for local development only (the milestone has no production
hosting). Settings that would change for production are marked "DEV ONLY".
"""

import json
import os
import sys
from pathlib import Path

# backend/ (where manage.py lives)
BASE_DIR = Path(__file__).resolve().parent.parent
# The repository root, which holds shared/app_config.json
REPO_ROOT = BASE_DIR.parent


# --- App identity -----------------------------------------------------------
# The app name lives in ONE place: shared/app_config.json. Every user-facing
# mention reads APP_NAME from here, never a hard-coded string.
with open(REPO_ROOT / "shared" / "app_config.json", encoding="utf-8") as f:
    APP_NAME = json.load(f)["app_name"]

# The fixed list of interests a person can pick on their profile.
INTEREST_CHOICES = [
    "Block parties",
    "Food drives",
    "Cleanups",
    "Live music",
    "Gardening",
]


# --- Security (DEV ONLY) ----------------------------------------------------
# A real secret key must come from the environment before any real hosting.
SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY", "dev-only-insecure-key-change-me-before-hosting"
)
DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"
# "*" lets the phone reach your computer by its Wi-Fi IP address during
# development. Production must list the real host name instead.
ALLOWED_HOSTS = ["*"]


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework.authtoken",
    # Our apps
    "accounts",
    "neighborhoods",
    "geocoding",
    "profiles",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "America/Denver"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Rate limits are counted in the cache. While tests run we use a cache that
# remembers nothing, so hundreds of quick test requests don't trip the
# limits; the throttle test switches the real cache back on for itself.
RUNNING_TESTS = len(sys.argv) > 1 and sys.argv[1] == "test"
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.dummy.DummyCache"
        if RUNNING_TESTS
        else "django.core.cache.backends.locmem.LocMemCache"
    }
}

# Uploaded profile photos. Served by Django only while DEBUG is on.
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"


# --- API --------------------------------------------------------------------
REST_FRAMEWORK = {
    # The phone sends "Authorization: Token <token>" on every request.
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    # Every error response has the same shape: {"code": ..., "detail": ...}
    "EXCEPTION_HANDLER": "config.errors.api_exception_handler",
    # Only the views that opt in (with throttle_scope) are rate-limited.
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.ScopedRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {
        # Slows down password guessing.
        "auth": "20/min",
        # Each match calls a free public geocoder; don't let one account
        # hammer it through our server.
        "join_match": "10/min",
    },
}


# --- Neighborhood data and geocoding ----------------------------------------
NEIGHBORHOODS_GEOJSON = BASE_DIR / "data" / "denver_statistical_neighborhoods.geojson"
NEIGHBORHOOD_ALIASES_JSON = BASE_DIR / "data" / "neighborhood_aliases.json"

GEOCODER_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress"
GEOCODER_TIMEOUT_SECONDS = 8


# --- Photos -----------------------------------------------------------------
PHOTO_MAX_BYTES = 5 * 1024 * 1024  # 5 MB


# --- Logging ----------------------------------------------------------------
# PRIVACY: httpx logs every request URL at INFO level, and the geocoder URL
# contains the street address. We raise httpx/httpcore to WARNING so the
# address can never reach the logs.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "httpx": {"level": "WARNING"},
        "httpcore": {"level": "WARNING"},
    },
}

if RUNNING_TESTS:
    # Real password hashing is deliberately slow. Tests create many users,
    # so they use a fast (insecure) hasher. Never used outside tests.
    PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
