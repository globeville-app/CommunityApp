from django.conf import settings
from django.db import models


class Neighborhood(models.Model):
    """
    One of Denver's official Statistical Neighborhoods.

    Rows are created from the GeoJSON file by `python manage.py load_neighborhoods`.
    The id is the city's own neighborhood ID, so it stays stable if we reload.
    The polygon itself stays in the file; the database only needs the name.
    """

    id = models.IntegerField(primary_key=True)
    name = models.CharField(max_length=100)
    # Fingerprint of the GeoJSON file this row came from.
    source_version = models.CharField(max_length=40)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.name


class NeighborhoodMatch(models.Model):
    """
    The neighborhood a user's address matched most recently.

    PRIVACY: only the neighborhood is kept. The address and its coordinates
    are never saved, here or anywhere else.

    The profile takes its neighborhood from here, so the app can't simply
    claim a neighborhood without matching an address first.
    """

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    neighborhood = models.ForeignKey(Neighborhood, on_delete=models.PROTECT)
    matched_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user} → {self.neighborhood}"
