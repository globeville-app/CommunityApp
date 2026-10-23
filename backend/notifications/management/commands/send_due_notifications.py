"""
python manage.py send_due_notifications [--all-now]

Sends every reminder and cancellation notice whose time has passed and
hasn't been sent, and the texts due to guests who RSVP'd on the web
(Milestone 5). Run it every 15 minutes (a scheduled job on DigitalOcean,
see README). Running it twice never sends anything twice.

--all-now (development only) sends every waiting reminder straight away,
for trying reminders on a phone without waiting for 5 PM.
"""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from notifications.models import JobRun, ScheduledNotification
from notifications.push import check_receipts
from notifications.sending import send_due_notifications
from guests.claims import make_pending_for_ended_events
from texting.sending import send_due_texts


class Command(BaseCommand):
    help = "Send due event reminders and cancellation notices."

    def add_arguments(self, parser):
        parser.add_argument("--all-now", action="store_true", help="Development only: send every waiting reminder now.")

    def handle(self, *args, **options):
        if options["all_now"]:
            if not settings.DEBUG:
                raise CommandError("--all-now is for trying reminders on your computer only.")
            ScheduledNotification.objects.filter(sent_at__isnull=True).update(send_at=timezone.now())
        sent = send_due_notifications()
        # Guests of events that ended can now claim their badge; then their texts go.
        make_pending_for_ended_events()
        texts = send_due_texts()
        # Then clean up phones that no longer have the app (Expo's receipts).
        check_receipts()
        JobRun.record_ok("send_due_notifications")  # the owner stats page watches this
        self.stdout.write(f"Sent {sent} notification(s) and {texts} text(s).")
