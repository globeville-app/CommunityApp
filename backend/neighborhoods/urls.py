from django.urls import path

from . import views

urlpatterns = [
    path("match", views.MatchView.as_view(), name="join-match"),
]
