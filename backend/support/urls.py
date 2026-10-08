from django.urls import path

from . import views

urlpatterns = [
    path("report", views.ProblemReportView.as_view(), name="support-report"),
]
