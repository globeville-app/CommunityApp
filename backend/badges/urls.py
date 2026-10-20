from django.urls import path

from . import views

# Mounted at /api/ in config/urls.py.
urlpatterns = [
    path("organizations/<int:org_id>/impact", views.OrganizationImpactView.as_view(), name="organization-impact"),
    path("badges/catalog", views.CatalogView.as_view(), name="badge-catalog"),
    path("badges/<str:badge_key>/shared", views.SharedView.as_view(), name="badge-shared"),
    path("me/badges", views.MyBadgesView.as_view(), name="my-badges"),
    path("me/collect", views.CollectCardsView.as_view(), name="my-collect"),
    path("me/geofences", views.GeofencesView.as_view(), name="my-geofences"),
    path("me/impact", views.ImpactView.as_view(), name="my-impact"),
    path("me/celebrations", views.CelebrationsView.as_view(), name="my-celebrations"),
    path("me/celebrations/seen", views.CelebrationsSeenView.as_view(), name="my-celebrations-seen"),
    path("me/checkin-offer/seen", views.CheckinOfferSeenView.as_view(), name="checkin-offer-seen"),
    path("members/<int:member_id>", views.MemberView.as_view(), name="member"),
    path("members/<int:member_id>/badges", views.MemberBadgesView.as_view(), name="member-badges"),
    path("members/<int:member_id>/block", views.BlockView.as_view(), name="member-block"),
    path("me/blocks", views.MyBlocksView.as_view(), name="my-blocks"),
    path("events/<int:event_id>/collect", views.CollectView.as_view(), name="event-collect"),
    path("events/<int:event_id>/decline", views.DeclineView.as_view(), name="event-decline"),
    path("events/<int:event_id>/checkin", views.CheckinView.as_view(), name="event-checkin"),
]
