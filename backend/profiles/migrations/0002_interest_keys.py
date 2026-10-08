"""
Interests used to be stored as English names ("Gardening"); now they are
keys ("gardening") that the app translates. Convert any saved profiles.
"""

from django.db import migrations

NAME_TO_KEY = {
    "Block parties": "block_parties",
    "Food drives": "food_drives",
    "Cleanups": "cleanups",
    "Live music": "live_music",
    "Gardening": "gardening",
}


def names_to_keys(apps, schema_editor):
    Profile = apps.get_model("profiles", "Profile")
    for profile in Profile.objects.all():
        profile.interests = [NAME_TO_KEY.get(item, item) for item in profile.interests]
        profile.save(update_fields=["interests"])


def keys_to_names(apps, schema_editor):
    key_to_name = {key: name for name, key in NAME_TO_KEY.items()}
    Profile = apps.get_model("profiles", "Profile")
    for profile in Profile.objects.all():
        profile.interests = [key_to_name.get(item, item) for item in profile.interests]
        profile.save(update_fields=["interests"])


class Migration(migrations.Migration):
    dependencies = [("profiles", "0001_initial")]

    operations = [migrations.RunPython(names_to_keys, keys_to_names)]
