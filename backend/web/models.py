"""Daily counters for the owner stats page: numbers only, nothing about who."""

from django.db import models
from django.db.models import F
from django.utils import timezone


class DailyCount(models.Model):
    """e.g. ("web_page_view", Oct 24, 37). Never tied to a person or a device."""

    day = models.DateField()
    key = models.CharField(max_length=40)
    count = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["day", "key"], name="one_count_per_day")]

    @classmethod
    def bump(cls, key):
        day = timezone.localdate()
        row, _ = cls.objects.get_or_create(day=day, key=key)
        cls.objects.filter(pk=row.pk).update(count=F("count") + 1)
