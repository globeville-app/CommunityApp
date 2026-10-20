"""
python manage.py cleanup_old_data [--dry-run]

Deletes what has done its job (accounts/retention.py has every rule). Runs
once a day on DigitalOcean (.do/app.yaml). --dry-run only counts.
"""

from django.core.management.base import BaseCommand

from accounts.retention import cleanup


class Command(BaseCommand):
    help = "Delete data that is no longer needed (see accounts/retention.py)."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Only count what would be deleted.")

    def handle(self, *args, **options):
        counts = cleanup(dry_run=options["dry_run"])
        verb = "Would clean" if options["dry_run"] else "Cleaned"
        for name, count in counts.items():
            self.stdout.write(f"{verb} {count} {name}")
