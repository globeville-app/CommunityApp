from django.urls import path

from . import invites, views

urlpatterns = [
    path("partiful-preview", views.PartifulPreviewView.as_view(), name="partiful-preview"),
    path("<int:event_id>", views.EventDetailView.as_view(), name="event-detail"),
    path("<int:event_id>/cancel", views.EventCancelView.as_view(), name="event-cancel"),
    path("<int:event_id>/going", views.GoingView.as_view(), name="event-going"),
    path("<int:event_id>/report", views.EventReportView.as_view(), name="event-report"),
    path("<int:event_id>/translate", views.EventTranslateView.as_view(), name="event-translate"),
    path("<int:event_id>/invite", invites.EventInviteView.as_view(), name="event-invite"),
    path("<int:event_id>/invite/reset", invites.EventInviteResetView.as_view(), name="event-invite-reset"),
    path("<int:event_id>/invite/shared", invites.InviteSharedView.as_view(), name="event-invite-shared"),
    path("<int:event_id>/guests", invites.GuestListView.as_view(), name="event-guests"),
    path("<int:event_id>/guests/<int:rsvp_id>/remove", invites.RemoveGuestView.as_view(), name="event-guest-remove"),
]
