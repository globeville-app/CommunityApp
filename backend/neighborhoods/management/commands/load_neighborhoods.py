from django.core.management.base import BaseCommand, CommandError

from neighborhoods.geo import NeighborhoodDataError, get_boundaries
from neighborhoods.models import Neighborhood


class Command(BaseCommand):
    help = "Create or update Neighborhood rows from the Denver GeoJSON file."

    def handle(self, *args, **options):
        try:
            boundaries = get_boundaries()
        except NeighborhoodDataError as error:
            raise CommandError(str(error))

        for area in boundaries.areas:
            Neighborhood.objects.update_or_create(
                id=area.id,
                defaults={"name": area.name, "source_version": boundaries.source_version},
            )
        self.stdout.write(
            self.style.SUCCESS(
                f"Loaded {len(boundaries.areas)} neighborhoods (source {boundaries.source_version})."
            )
        )
