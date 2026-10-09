"""
Milestone 2: interests become event categories. Convert Milestone 1's five
interest keys to their categories and drop anything else. Only a count of
dropped keys is logged, never who they belonged to.
"""

import logging

from django.db import migrations

logger = logging.getLogger(__name__)

OLD_TO_NEW = {
    "block_parties": "block_party",
    "food_drives": "donation_drive",
    "cleanups": "cleanup",
    "live_music": "live_music",
    "gardening": "gardening",
}


def convert(interests):
    """Returns (new keys without duplicates, number dropped)."""
    converted, dropped = [], 0
    for key in interests or []:
        new = OLD_TO_NEW.get(key)
        if new is None:
            dropped += 1
        elif new not in converted:
            converted.append(new)
    return converted, dropped


def forwards(apps, schema_editor):
    Profile = apps.get_model("profiles", "Profile")
    total_dropped = 0
    for profile in Profile.objects.all():
        new, dropped = convert(profile.interests)
        total_dropped += dropped
        if new != profile.interests:
            profile.interests = new
            profile.save(update_fields=["interests"])
    if total_dropped:
        logger.warning("Interests migration dropped %d unrecognized interest keys", total_dropped)


class Migration(migrations.Migration):
    dependencies = [("profiles", "0003_profile_role")]

    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
