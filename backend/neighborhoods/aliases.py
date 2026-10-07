"""
Local nicknames for neighborhoods, e.g. "LoHi" for Highland.

data/neighborhood_aliases.json maps each alias to the official neighborhood
names it covers. One alias can cover several neighborhoods:

    { "LoHi": ["Highland"] }
"""

import json
from functools import lru_cache

from django.conf import settings


def load_aliases(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def aliases_for(official_name, alias_map):
    """All aliases that point at this official neighborhood name, sorted."""
    return sorted(alias for alias, names in alias_map.items() if official_name in names)


@lru_cache(maxsize=1)
def get_alias_map():
    return load_aliases(settings.NEIGHBORHOOD_ALIASES_JSON)
