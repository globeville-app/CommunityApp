"""
Django settings for the backend.

One file for both places it runs:
  - development (your computer, or Claude Code in the cloud): the defaults
    below just work, with SQLite and files on disk;
  - production (DigitalOcean App Platform, docs/GO_LIVE.md): every secret and
    every production choice comes from environment variables, listed in
    the README under "Going live". Nothing secret is ever in this file.

Production is switched on by DJANGO_DEBUG=0.
"""

import json
import os
import sys
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured

# backend/ (where manage.py lives)
BASE_DIR = Path(__file__).resolve().parent.parent
# The repository root, which holds shared/app_config.json
REPO_ROOT = BASE_DIR.parent


# --- App identity -----------------------------------------------------------
# The app name lives in ONE place: shared/app_config.json. Every user-facing
# mention reads APP_NAME from here, never a hard-coded string.
with open(REPO_ROOT / "shared" / "app_config.json", encoding="utf-8") as f:
    APP_NAME = json.load(f)["app_name"]

# Interests are event category keys now (events/categories.py).

# The app's language files. The server reads the category search hints from
# them, so the hints are written in one place.
LANGUAGE_FILES = [
    REPO_ROOT / "mobile" / "src" / "i18n" / "en.json",
    REPO_ROOT / "mobile" / "src" / "i18n" / "es.json",
]

# Expo push (docs/MILESTONE_4.md). Optional: with "enhanced push security"
# on in the Expo account, only requests carrying this token can send pushes.
EXPO_ACCESS_TOKEN = os.environ.get("EXPO_ACCESS_TOKEN", "")

# Languages the app is available in (docs/LANGUAGE.md). New members default
# to English until they pick.
LANGUAGES_AVAILABLE = ["en", "es"]
DEFAULT_LANGUAGE_CODE = "en"


# --- Security -----------------------------------------------------------------
DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"
DEV_SECRET_KEY = "dev-only-insecure-key-change-me-before-hosting"
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", DEV_SECRET_KEY)

if DEBUG:
    # "*" lets the phone reach your computer by its Wi-Fi IP address.
    ALLOWED_HOSTS = ["*"]
else:
    if SECRET_KEY == DEV_SECRET_KEY:
        raise ImproperlyConfigured("Set DJANGO_SECRET_KEY in the environment before running in production.")
    # e.g. "api.globeville.app"
    ALLOWED_HOSTS = [h.strip() for h in os.environ.get("ALLOWED_HOSTS", "").split(",") if h.strip()]
    # e.g. "https://api.globeville.app" (the admin's login form needs it)
    CSRF_TRUSTED_ORIGINS = [o.strip() for o in os.environ.get("CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()]
    # App Platform handles HTTPS in front of Django and says so in this header.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 60 * 60 * 24 * 365  # .app domains are HTTPS-only anyway
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django_otp",
    "django_otp.plugins.otp_totp",
    "rest_framework",
    "rest_framework.authtoken",
    # Our apps
    "accounts",
    "neighborhoods",
    "geocoding",
    "profiles",
    "support",
    "events",
    "stats",
    "badges",
    "notifications",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # Serves the admin's CSS/JS in production (no separate file server needed).
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    # Two-step admin login (see ADMIN_REQUIRE_2FA below).
    "django_otp.middleware.OTPMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        # Project-wide template overrides, e.g. the admin home page's link to
        # the owner stats page.
        "DIRS": [BASE_DIR / "templates"],
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

# Development: a SQLite file. Production: managed Postgres, from DATABASE_URL
# (e.g. "postgresql://user:password@host:25060/globeville?sslmode=require").
DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600,
        conn_health_checks=True,
    )
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
STATIC_ROOT = BASE_DIR / "staticfiles"  # filled by collectstatic when deploying
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

# Uploaded files.
#  - Development: profile photos in backend/media (served by Django while
#    DEBUG is on); problem-report screenshots in backend/private_media, never
#    served at a URL.
#  - Production: a PRIVATE DigitalOcean Spaces bucket. Photos are shown
#    through short-lived signed links; screenshots sit in a separate
#    private/ folder that only the admin reads (support/admin.py).
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
PRIVATE_MEDIA_ROOT = BASE_DIR / "private_media"

USE_SPACES = bool(os.environ.get("SPACES_BUCKET"))
if USE_SPACES:
    _spaces = {
        "bucket_name": os.environ["SPACES_BUCKET"],
        "endpoint_url": os.environ["SPACES_ENDPOINT"],  # e.g. https://sfo3.digitaloceanspaces.com
        "region_name": os.environ.get("SPACES_REGION", "sfo3"),
        "access_key": os.environ["SPACES_KEY"],
        "secret_key": os.environ["SPACES_SECRET"],
        "default_acl": "private",
        "querystring_auth": True,  # signed links...
        "querystring_expire": 3600,  # ...that stop working after an hour
        "file_overwrite": False,
    }
    STORAGES = {
        "default": {"BACKEND": "storages.backends.s3.S3Storage", "OPTIONS": {**_spaces, "location": "media"}},
        "private": {"BACKEND": "storages.backends.s3.S3Storage", "OPTIONS": {**_spaces, "location": "private"}},
    }
else:
    STORAGES = {
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "private": {"BACKEND": "support.models.PrivateStorage"},
    }
# The admin's CSS/JS: compressed, with versioned names, in production. Chosen
# by DEBUG (not by Spaces) so the build step and the server always agree.
STORAGES["staticfiles"] = {
    "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
    if DEBUG
    else "whitenoise.storage.CompressedManifestStaticFilesStorage"
}


# --- Admin --------------------------------------------------------------------
# Where Django admin lives. Production uses a non-default path (GO_LIVE.md),
# set in the environment, e.g. ADMIN_URL="team-7f3k/".
ADMIN_URL = os.environ.get("ADMIN_URL", "admin/")
# Two-step login for the admin (a code from an authenticator app). On in
# production by default; see "Admin two-step login" in the README.
ADMIN_REQUIRE_2FA = os.environ.get("ADMIN_REQUIRE_2FA", "0" if DEBUG else "1") == "1"
OTP_TOTP_ISSUER = APP_NAME


# --- API --------------------------------------------------------------------
REST_FRAMEWORK = {
    # The phone sends "Authorization: Token <token>" on every request.
    "DEFAULT_AUTHENTICATION_CLASSES": [
        # Token login, plus a once-an-hour "last seen" stamp (owner stats).
        "accounts.authentication.SeenTokenAuthentication",
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
        # "Report a problem": per member, or per IP address when signed out.
        "problem_report": "5/day",
    },
}


# --- Neighborhood data and geocoding ----------------------------------------
NEIGHBORHOODS_GEOJSON = BASE_DIR / "data" / "denver_statistical_neighborhoods.geojson"
NEIGHBORHOOD_ALIASES_JSON = BASE_DIR / "data" / "neighborhood_aliases.json"

GEOCODER_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress"
GEOCODER_TIMEOUT_SECONDS = 8


# --- Events -----------------------------------------------------------------
# Machine translation provider for events (events/translation.py). Empty until
# the owner picks one (docs/LANGUAGE.md); then the dotted path of a class that
# implements events.translation.Translator.
TRANSLATOR_CLASS = os.environ.get("TRANSLATOR_CLASS", "")


# --- Photos -----------------------------------------------------------------
PHOTO_MAX_BYTES = 5 * 1024 * 1024  # 5 MB


# --- Email ------------------------------------------------------------------
# Development prints emails in the server window instead of sending them.
# Production sets EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
# and the EMAIL_* settings below in the environment (see the README).
EMAIL_BACKEND = os.environ.get("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
EMAIL_HOST = os.environ.get("EMAIL_HOST", "localhost")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "1") == "1"
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "webmaster@localhost")

# Who gets an email for each problem report: a comma-separated list in the
# environment, e.g. PROBLEM_REPORT_EMAILS="ana@example.org,team@example.org".
# Never write anyone's address in the code.
PROBLEM_REPORT_EMAILS = [
    address.strip() for address in os.environ.get("PROBLEM_REPORT_EMAILS", "").split(",") if address.strip()
]


# --- Logging ----------------------------------------------------------------
# PRIVACY: httpx logs every request URL at INFO level, and the geocoder URL
# contains the street address. Pillow logs photo EXIF tags (including GPS)
# at DEBUG level. We raise these to WARNING so neither can reach the logs.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "httpx": {"level": "WARNING"},
        "httpcore": {"level": "WARNING"},
        "PIL": {"level": "WARNING"},
        # Send Django's messages through the root handler only (so they print
        # once, and the privacy tests, which watch the root logger, see them).
        "django": {"handlers": [], "level": "INFO"},
    },
}

if RUNNING_TESTS:
    # Real password hashing is deliberately slow. Tests create many users,
    # so they use a fast (insecure) hasher. Never used outside tests.
    PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
