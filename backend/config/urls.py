from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from profiles import views as profile_views

from . import views

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/config", views.app_config, name="app-config"),
    path("api/auth/", include("accounts.urls")),
    path("api/join/", include("neighborhoods.urls")),
    path("api/profile", profile_views.ProfileView.as_view(), name="profile"),
    path("api/profile/me", profile_views.MyProfileView.as_view(), name="profile-me"),
    path("api/profile/photo", profile_views.ProfilePhotoView.as_view(), name="profile-photo"),
]

if settings.DEBUG:
    # DEV ONLY: let Django serve uploaded photos. Real hosting uses file storage.
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# The admin's page titles read the app name from settings too.
admin.site.site_header = f"{settings.APP_NAME} admin"
admin.site.site_title = f"{settings.APP_NAME} admin"
