from django.urls import path

from . import views

urlpatterns = [
    path("me/push-tokens", views.PushTokensView.as_view(), name="push-tokens"),
    path("me/notif-offer/seen", views.NotifOfferSeenView.as_view(), name="notif-offer-seen"),
]
