"""
Set up two-step admin login for a staff account:

    python manage.py add_admin_2fa you@example.com

It prints a QR code (and the same link as text). Scan it with an
authenticator app (Google Authenticator, 1Password, Authy...). From then on,
the admin login asks for the 6-digit code from that app.
"""

import io

import qrcode
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django_otp.plugins.otp_totp.models import TOTPDevice


class Command(BaseCommand):
    help = "Set up two-step admin login (an authenticator app code) for a staff account."

    def add_arguments(self, parser):
        parser.add_argument("username")

    def handle(self, username, **options):
        user = get_user_model().objects.filter(username=username).first()
        if user is None or not user.is_staff:
            raise CommandError(f"No staff account called {username!r}. Create one with createsuperuser first.")
        TOTPDevice.objects.filter(user=user).delete()  # replaces any earlier phone
        device = TOTPDevice.objects.create(user=user, name="Authenticator app", confirmed=True)

        qr = qrcode.QRCode(border=1)
        qr.add_data(device.config_url)
        text = io.StringIO()
        qr.print_ascii(out=text, invert=True)
        self.stdout.write(text.getvalue())
        self.stdout.write("Scan this with your authenticator app, or paste this link into it:")
        self.stdout.write(device.config_url)
        self.stdout.write(self.style.SUCCESS(f"Two-step login is set up for {username}."))
