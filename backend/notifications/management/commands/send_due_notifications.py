"""
python manage.py send_due_notifications

Sends every reminder and cancellation notice whose time has passed and
hasn't been sent. Run it every 15 minutes (a scheduled job on DigitalOcean,
see README). Running it twice never sends anything twice.
"""

from django.core.management.base import BaseCommand

from notifications.models import JobRun
from notifications.sending import send_due_notifications


class Command(BaseCommand):
    help = "Send due event reminders and cancellation notices."

    def handle(self, *args, **options):
        sent = send_due_notifications()
        JobRun.record_ok("send_due_notifications")  # the owner stats page watches this
        self.stdout.write(f"Sent {sent} notification(s).")
