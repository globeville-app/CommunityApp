from django.urls import path

from . import views

urlpatterns = [
    path("delete", views.DeleteAccountView.as_view(), name="account-delete"),
    path("verify-email", views.VerifyEmailView.as_view(), name="verify-email"),
    path("verify-email/resend", views.ResendVerificationView.as_view(), name="verify-email-resend"),
]
