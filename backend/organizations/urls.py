from django.urls import path

from . import views

urlpatterns = [
    path("organizations", views.OrganizationListView.as_view(), name="organizations"),
    path("organizations/<int:org_id>", views.OrganizationDetailView.as_view(), name="organization"),
    path("organizations/<int:org_id>/photo", views.OrganizationPhotoView.as_view(), name="organization-photo"),
    path("organizations/<int:org_id>/admins", views.OrganizationAdminsView.as_view(), name="organization-admins"),
    path("organizations/<int:org_id>/follow", views.FollowView.as_view(), name="organization-follow"),
    path("organizations/<int:org_id>/report", views.OrganizationReportView.as_view(), name="organization-report"),
    path("organizations/<int:org_id>/translate", views.OrganizationTranslateView.as_view(), name="organization-translate"),
    path("me/organizations", views.MyOrganizationsView.as_view(), name="my-organizations"),
    path("organizations/<int:org_id>/invites", views.OrganizationInvitesView.as_view(), name="organization-invites"),
    path("me/organization-invites", views.MyInvitesView.as_view(), name="my-organization-invites"),
    path("me/organization-invites/<int:invite_id>", views.MyInviteView.as_view(), name="my-organization-invite"),
    path("neighborhoods", views.NeighborhoodListView.as_view(), name="neighborhoods"),
]
