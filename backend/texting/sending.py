"""
When guest texts go out, and sending them (docs/MILESTONE_5.md, "Texting").

Rules, in the order they're checked when a text is due:
  - each text is sent at most once: it's "claimed" with one database update
    first, like push notifications, so two runs of the job can't both send it;
  - nothing goes to a number that replied STOP or that the team blocked;
  - reminders and collect texts need the RSVP to still stand;
  - quiet hours: nothing between 8:00 PM and 9:00 AM Denver time except the
    code the guest just asked for; a text due then waits until 9:00 AM;
  - the monthly budget: past 100%, reminders and collect texts are skipped
    (codes and cancellations still go); at 80% the owner gets an email.

PRIVACY: phone numbers and message text are never logged here.
"""

from datetime import datetime, time, timedelta
from decimal import Decimal

from django.conf import settings
from django.core import signing
from django.core.cache import cache
from django.core.mail import send_mail
from django.db.models import Sum
from django.utils import timezone

from config.wording import words

from .models import ScheduledText
from .texter import TextUnavailable, get_texter

QUIET_START = 20  # 8:00 PM
QUIET_END = 9  # 9:00 AM
COLLECT_HOUR = 10  # 10:00 AM the morning after the event ends
OPTIONAL_KINDS = {ScheduledText.Kind.REMINDER, ScheduledText.Kind.COLLECT}
CANT_MAKE_IT_SALT = "cant-make-it"


def _denver(dt):
    return timezone.localtime(dt)


def _at(day, hour):
    return timezone.make_aware(datetime.combine(day, time(hour)), timezone.get_current_timezone())


def outside_quiet_hours(when):
    """The same moment, or 9:00 AM Denver time if `when` falls in quiet hours."""
    local = _denver(when)
    if local.hour < QUIET_END:
        return _at(local.date(), QUIET_END)
    if local.hour >= QUIET_START:
        return _at(local.date() + timedelta(days=1), QUIET_END)
    return when


def collect_time(event):
    """10:00 AM Denver time the morning after the event ends."""
    from events.timing import event_end

    return _at(_denver(event_end(event)).date() + timedelta(days=1), COLLECT_HOUR)


def schedule(guest, event, kind, send_at):
    """Make (or keep) the one text of this kind for this guest and event."""
    text, _ = ScheduledText.objects.get_or_create(
        guest=guest, event=event, kind=kind, defaults={"send_at": outside_quiet_hours(send_at)}
    )
    return text


def cant_make_it_link(rsvp):
    token = signing.dumps(rsvp.pk, salt=CANT_MAKE_IT_SALT, compress=True)
    return f"{settings.PUBLIC_BASE_URL}/r/{token}"


# ---- The budget -------------------------------------------------------------------


def month_start(now):
    local = _denver(now)
    return _at(local.date().replace(day=1), 0)


def spent_this_month(now=None):
    now = now or timezone.now()
    total = ScheduledText.objects.filter(sent_at__gte=month_start(now)).aggregate(total=Sum("cost_usd"))["total"]
    return float(total or 0)


def budget_reached(now):
    return spent_this_month(now) >= settings.SMS_MONTHLY_BUDGET_USD


def _check_budget_alert(now):
    """At 80% of the month's budget, email the owner once that month."""
    if not settings.OWNER_ALERT_EMAILS or spent_this_month(now) < 0.8 * settings.SMS_MONTHLY_BUDGET_USD:
        return
    month = _denver(now).strftime("%Y-%m")
    if not cache.add(f"sms-budget-alert:{month}", 1, timeout=40 * 24 * 3600):
        return  # already told them this month
    send_mail(
        subject=f"{settings.APP_NAME}: texting is at 80% of this month's budget",
        message=(
            f"Texts this month have cost ${spent_this_month(now):.2f} of the ${settings.SMS_MONTHLY_BUDGET_USD:.2f} "
            "budget (SMS_MONTHLY_BUDGET_USD). At 100%, reminders and collect texts pause until next month; "
            "codes and cancellations keep going."
        ),
        from_email=None,
        recipient_list=settings.OWNER_ALERT_EMAILS,
    )


# ---- The words ---------------------------------------------------------------------


def body_for(text):
    from notifications.texts import _clock, _day, title_for

    guest, event = text.guest, text.event
    w = words("texts", guest.language)
    starts = _denver(event.starts_at)
    title = title_for(event, guest.language)
    if text.kind == ScheduledText.Kind.CANCELLED:
        return w["cancelled"].format(app=settings.APP_NAME, title=title, date=_day(starts, guest.language))
    rsvp = guest.rsvps.get(event=event)
    if text.kind == ScheduledText.Kind.REMINDER:
        time_ = _clock(starts, guest.language)
        return w["reminder"].format(app=settings.APP_NAME, title=title, time=time_, link=cant_make_it_link(rsvp))
    from guests.claims import pending_for

    link = f"{settings.PUBLIC_BASE_URL}/c/{pending_for(rsvp).claim_token}"
    return w["collect"].format(app=settings.APP_NAME, title=title, link=link)


def _deliver(text, body, now):
    """Hand it to the provider and record what it cost."""
    sent = get_texter().send(text.guest.phone, body)
    ScheduledText.objects.filter(pk=text.pk).update(
        provider_message_id=sent.message_id, cost_usd=Decimal(str(settings.SMS_COST_PER_TEXT_USD))
    )
    _check_budget_alert(now)


# ---- Codes (sent straight away) -------------------------------------------------------


def send_code(guest, code, now=None):
    """The 6-digit sign-in code. Quiet hours don't apply: the guest just asked for it."""
    now = now or timezone.now()
    text = ScheduledText.objects.create(guest=guest, kind=ScheduledText.Kind.CODE, send_at=now, sent_at=now)
    body = words("texts", guest.language)["code"].format(app=settings.APP_NAME, code=code)
    try:
        _deliver(text, body, now)
    except TextUnavailable:
        text.delete()
        raise


# ---- Scheduled texts ---------------------------------------------------------------------


def _skip(text, reason):
    """Mark it as never to be sent, and why. Returns False (nothing went out)."""
    ScheduledText.objects.filter(pk=text.pk).update(skipped_reason=reason)
    return False


def send_text(text, now=None):
    """Send one due text if it should still go. Returns True if it went out."""
    now = now or timezone.now()
    claimed = ScheduledText.objects.filter(pk=text.pk, sent_at__isnull=True, skipped_reason="").update(sent_at=now)
    if not claimed:
        return False  # another run has it, or it was skipped

    guest, event = text.guest, text.event
    if guest.opted_out_at:
        return _skip(text, "opted_out")
    if guest.blocked_at:
        return _skip(text, "blocked")
    if text.kind in OPTIONAL_KINDS:
        from guests.models import ACTIVE_RSVP

        if not guest.rsvps.filter(ACTIVE_RSVP, event=event).exists():
            return _skip(text, "rsvp_cancelled")
        if event.status == event.Status.CANCELLED:
            return _skip(text, "event_cancelled")
        if text.kind == ScheduledText.Kind.REMINDER and event.starts_at <= now:
            return _skip(text, "too_late")

    later = outside_quiet_hours(now)
    if later != now:
        # Quiet hours: give it back, to go at 9:00 AM.
        ScheduledText.objects.filter(pk=text.pk).update(sent_at=None, send_at=later)
        return False
    if text.kind in OPTIONAL_KINDS and budget_reached(now):
        return _skip(text, "budget")

    try:
        _deliver(text, body_for(text), now)
    except TextUnavailable:
        ScheduledText.objects.filter(pk=text.pk).update(sent_at=None)  # the next run tries again
        return False
    return True


def send_due_texts(now=None):
    """Every text whose time has come. Run by send_due_notifications every 15 minutes."""
    now = now or timezone.now()
    due = ScheduledText.objects.filter(sent_at__isnull=True, skipped_reason="", send_at__lte=now).select_related(
        "guest", "event"
    )
    return sum(1 for text in due.order_by("send_at", "pk") if send_text(text, now))
