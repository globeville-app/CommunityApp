from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django_otp.admin import OTPAdminSite
from django.urls import include, path

from events import views as event_views
from profiles import views as profile_views
from stats.views import owner_stats

from . import views

if settings.ADMIN_REQUIRE_2FA:
    # Admin login also asks for a 6-digit code from an authenticator app.
    # Set one up with: python manage.py add_admin_2fa <username>
    admin.site.__class__ = OTPAdminSite

urlpatterns = [
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
    path("api/events", event_views.EventListView.as_view(), name="events"),
    path("api/events/", include("events.urls")),
]

if settings.DEBUG:
    # DEV ONLY: let Django serve uploaded photos. Real hosting uses file storage.
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# The admin's page titles read the app name from settings too.
admin.site.site_header = f"{settings.APP_NAME} admin"
admin.site.site_title = f"{settings.APP_NAME} admin"
