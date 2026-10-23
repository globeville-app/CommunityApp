from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django_otp.admin import OTPAdminSite
from django.urls import include, path

from events import invites as event_invites
from guests import views as guest_views
from events import views as event_views
from profiles import views as profile_views
from stats.views import owner_stats
from texting import webhook as sms_webhook
from web import views as web_views

from . import views

if settings.ADMIN_REQUIRE_2FA:
    # Admin login also asks for a 6-digit code from an authenticator app.
    # Set one up with: python manage.py add_admin_2fa <username>
    admin.site.__class__ = OTPAdminSite

urlpatterns = [
    # Milestone 5: the guest web pages at globeville.app, and texting replies.
    path("", web_views.landing, name="landing"),
    path("e/<str:code>", web_views.event_page, name="web-event"),
    path("e/<str:code>/rsvp", web_views.rsvp_start, name="web-rsvp"),
    path("e/<str:code>/verify", web_views.rsvp_verify, name="web-verify"),
    path("e/<str:code>/cancel-rsvp", web_views.rsvp_cancel, name="web-cancel-rsvp"),
    path("e/<str:code>/calendar.ics", web_views.calendar_file, name="web-calendar"),
    path("r/<str:token>", web_views.cant_make_it, name="web-cant-make-it"),
    path("c/<str:token>", web_views.collect_page, name="web-collect"),
    path(".well-known/apple-app-site-association", web_views.apple_app_site_association),
    path(".well-known/assetlinks.json", web_views.android_asset_links),
    path("webhooks/sms", sms_webhook.incoming, name="sms-webhook"),
    # The owner stats page sits inside admin, behind the same login (and
    # two-step code, when on) as the rest of admin.
    path(f"{settings.ADMIN_URL}stats/", admin.site.admin_view(owner_stats), name="owner-stats"),
    path(settings.ADMIN_URL, admin.site.urls),
    path("api/config", views.app_config, name="app-config"),
    path("api/auth/", include("accounts.urls")),
    path("api/account/", include("accounts.account_urls")),
    path("api/join/", include("neighborhoods.urls")),
    path("api/profile", profile_views.ProfileView.as_view(), name="profile"),
    path("api/profile/me", profile_views.MyProfileView.as_view(), name="profile-me"),
    path("api/profile/photo", profile_views.ProfilePhotoView.as_view(), name="profile-photo"),
    path("api/support/", include("support.urls")),
    path("api/", include("badges.urls")),
    path("api/", include("notifications.urls")),
    path("api/", include("organizations.urls")),
    path("api/invites/<str:code>", event_invites.OpenInviteView.as_view(), name="open-invite"),
    path("api/claims", guest_views.ClaimView.as_view(), name="claims"),
    path("api/events", event_views.EventListView.as_view(), name="events"),
    path("api/events/", include("events.urls")),
]

if settings.DEBUG:
    # DEV ONLY: let Django serve uploaded photos. Real hosting uses file storage.
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Unknown API addresses and crashes answer {"code": ...} like every other error.
handler404 = "config.errors.not_found"
handler500 = "config.errors.server_error"

# The admin's page titles read the app name from settings too.
admin.site.site_header = f"{settings.APP_NAME} admin" + (
    "" if settings.APP_ENVIRONMENT == "production" else f" ({settings.APP_ENVIRONMENT.upper()})"
)
admin.site.site_title = f"{settings.APP_NAME} admin"
