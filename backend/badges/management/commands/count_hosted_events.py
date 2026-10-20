"""
python manage.py count_hosted_events

Hosted events count only once they've ended (docs/BADGES.md). When 2+
neighbors checked in during an event and nobody collects it afterwards,
this is what credits the host. Runs with the 15-minute notifications job
(.do/app.yaml). Safe to run twice.
"""

from django.core.management.base import BaseCommand

from badges.engine import count_ended_events


class Command(BaseCommand):
    help = "Credit hosts for events that have ended with 2 or more neighbors."

    def handle(self, *args, **options):
        self.stdout.write(f"Counted {count_ended_events()} hosted event(s).")
