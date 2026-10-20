"""
Attendance at resource fairs and donation drives is no longer stored (review
D4): each event keeps only how many neighbors went, and the rows saying who
went are deleted. Badge stages are never lowered, so nobody loses anything.
"""

from django.db import migrations
from django.db.models import Count

SENSITIVE_CATEGORIES = ["resource_fair", "donation_drive"]  # badges/config.py at the time


def forget(apps, schema_editor):
    Attendance = apps.get_model("badges", "Attendance")
    Event = apps.get_model("events", "Event")
    rows = Attendance.objects.filter(event__category__in=SENSITIVE_CATEGORIES)
    for item in rows.values("event").annotate(n=Count("id")):
        Event.objects.filter(pk=item["event"]).update(anonymous_attendee_count=item["n"])
    rows.delete()


class Migration(migrations.Migration):
    dependencies = [
        ("badges", "0002_remove_badgestate_one_state_per_badge_and_more"),
        ("events", "0004_anonymous_attendee_count"),
    ]

    operations = [migrations.RunPython(forget, migrations.RunPython.noop)]
