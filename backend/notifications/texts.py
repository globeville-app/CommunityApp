"""
The words in push notifications, in the member's language. They live in the
app's language files (mobile/src/i18n/en.json and es.json, under "push"), so
every word the members see is in one place for the Spanish reviewer.

PRIVACY: only the event title and when it starts. Never the meeting spot,
an address or anyone's name, because push text shows on locked screens.
"""

import json
from functools import lru_cache
from pathlib import Path

from django.conf import settings
from django.utils import timezone

from accounts.models import language_of


@lru_cache(maxsize=1)
def _strings():
    """{"en": {...push strings...}, "es": {...}}, from the app's language files."""
    result = {}
    for path in settings.LANGUAGE_FILES:
        with open(path, encoding="utf-8") as f:
            result[Path(path).stem] = json.load(f)["push"]
    return result


def _clock(when, language):
    """10:00 AM / 10:00 a. m. (Denver time)."""
    hour = when.hour % 12 or 12
    suffix = _strings()[language]["am" if when.hour < 12 else "pm"]
    return f"{hour}:{when.minute:02d} {suffix}"


def _day(when, language):
    """Sat, Oct 24 / sáb 24 oct."""
    words = _strings()[language]
    weekday = words["weekdays"].split(",")[when.weekday()]
    month = words["months"].split(",")[when.month - 1]
    return words["date"].format(weekday=weekday, day=when.day, month=month)


def title_for(event, language):
    """The organizer's own words in the member's language if they wrote them; never a machine translation."""
    if event.language != language and event.title_alt:
        return event.title_alt
    return event.title


def push_text(kind, event, user):
    """The notification body: "Tomorrow 10:00 AM · Alley Cleanup"."""
    language = language_of(user)
    words = _strings()[language]
    starts = timezone.localtime(event.starts_at)
    title = title_for(event, language)
    if kind == "reminder":
        return words["reminder"].format(time=_clock(starts, language), title=title)
    return words["cancelled"].format(day=_day(starts, language), time=_clock(starts, language), title=title)
