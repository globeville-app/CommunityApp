from django.urls import path

from . import views

urlpatterns = [
    path("delete", views.DeleteAccountView.as_view(), name="account-delete"),
]
