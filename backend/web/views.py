"""
The guest web pages (docs/MILESTONE_5.md, "Web pages"): what someone sees
when they open an invite link in a phone browser, with no app and no
account. Plain Django templates, English or Spanish.

PRIVACY:
  - the meeting spot is shown only to a guest who has RSVP'd (never in the
    link preview);
  - phone numbers are never shown or logged;
  - who else is going is never shown, only the count.
"""

import icalendar
from django.conf import settings
from django.core import signing
from django.http import Http404, HttpResponse, JsonResponse
from django.shortcuts import redirect, render
from django.utils import timezone, translation
from django.utils.translation import gettext_lazy as _
from django.views.decorators.http import require_POST

from config.errors import ApiError
from config.throttling import client_ip
from events.models import Event, InviteLink
from events.timing import event_end, has_ended
from guests import rsvp as guest_rsvp
from guests.models import ACTIVE_RSVP, GuestRSVP, PendingAttendance
from texting.sending import CANT_MAKE_IT_SALT

from .guest_session import current_guest, sign_in
from .models import DailyCount

LANG_COOKIE = "lang"

# What each error code says on the page.
ERRORS = {
    "consent_required": _("Please check the box to agree to event texts."),
    "first_name_required": _("Please enter your first name."),
    "first_name_too_long": _("Please use 30 characters or fewer."),
    "phone_not_us": _("Please enter a US mobile number."),
    "guest_limit": _("This event has reached its limit of RSVPs."),
    "rate_limited": _("Too many tries. Please wait a little and try again."),
    "phone_blocked": _("This number can't RSVP here."),
    "phone_opted_out": _(
        "You replied STOP to our texts, so we can't text you a code. "
        "Reply START to that same text thread to turn them back on, then try again."
    ),
    "code_invalid": _("That code isn't right. Check the text and try again."),
    "code_expired": _("That code has expired. Ask for a new one."),
    "too_many_attempts": _("Too many wrong tries. Ask for a new code."),
    "event_closed": _("This event has ended or was cancelled."),
    "rsvp_removed": _("The host removed this RSVP."),
    "texting_unavailable": _("We couldn't send the text just now. Please try again in a minute."),
}


# ---- Language ------------------------------------------------------------------


def page_language(request):
    """The ?lang= switch (remembered in a cookie), then the cookie, then the browser, then English."""
    chosen = request.GET.get("lang") or request.COOKIES.get(LANG_COOKIE)
    if chosen in ("en", "es"):
        return chosen
    browser = translation.get_language_from_request(request) or "en"
    return "es" if browser.startswith("es") else "en"


def _render(request, template, context, status=200):
    language = page_language(request)
    with translation.override(language):
        response = render(
            request,
            template,
            {"app_name": settings.APP_NAME, "language": language, "support_email": settings.SUPPORT_EMAIL, **context},
            status=status,
        )
    if request.GET.get("lang") in ("en", "es"):
        response.set_cookie(LANG_COOKIE, request.GET["lang"], max_age=365 * 24 * 3600, samesite="Lax")
    return response


# ---- The event page --------------------------------------------------------------


def _link_or_404(code):
    link = InviteLink.objects.filter(code=code).select_related("event__organization", "event__organizer__profile").first()
    if link is None:
        raise Http404
    return link


def _host_name(event):
    if event.organization_id:
        return event.organization.name
    profile = getattr(event.organizer, "profile", None) if event.organizer_id else None
    return profile.display_name if profile else ""


def _in_language(event, language):
    """The organizer's own words in the visitor's language, when they wrote them."""
    if event.language != language and event.title_alt:
        return event.title_alt, event.description_alt or event.description
    return event.title, event.description


def _active_rsvp(guest, event):
    if guest is None:
        return None
    return GuestRSVP.objects.filter(ACTIVE_RSVP, guest=guest, event=event).first()


def event_page(request, code, step=None, error=None, pending="", form=None, status=200):
    link = _link_or_404(code)
    if link.revoked_at is not None:
        return _render(request, "web/expired.html", {}, status=410)
    event = link.event
    if event.status == Event.Status.CANCELLED:
        return _render(request, "web/cancelled.html", {"title": event.title}, status=410)
    if request.method == "GET" and step is None:
        DailyCount.bump("web_page_view")

    from events.views import going_total

    language = page_language(request)
    title, description = _in_language(event, language)
    guest = current_guest(request)
    rsvp = _active_rsvp(guest, event)
    context = {
        "code": code,
        "event": event,
        "title": title,
        "description": description,
        "starts": timezone.localtime(event.starts_at),
        "ends": timezone.localtime(event.ends_at) if event.ends_at else None,
        "host_name": _host_name(event),
        "going_count": going_total(event),
        "is_past": has_ended(event, timezone.now()),
        "rsvp": rsvp,
        "step": step or ("going" if rsvp else "form"),
        "error": ERRORS.get(error) if error else None,
        "error_code": error,
        "pending": pending,
        "form": form or {},
        "page_url": f"{settings.PUBLIC_BASE_URL}/e/{code}",
        "og_image": f"{settings.PUBLIC_BASE_URL}{settings.STATIC_URL}web/og-default.png",
        "app_link": f"{settings.APP_SCHEME}://e/{code}",
    }
    return _render(request, "web/event.html", context, status=status)


@require_POST
def rsvp_start(request, code):
    link = _link_or_404(code)
    if link.revoked_at is not None:
        return _render(request, "web/expired.html", {}, status=410)
    form = {
        "first_name": request.POST.get("first_name", ""),
        "phone": request.POST.get("phone", ""),
        "consent_event_texts": request.POST.get("consent_event_texts") == "on",
        "consent_collect": request.POST.get("consent_collect") == "on",
        "wants_reminder": request.POST.get("wants_reminder") == "on",
    }
    try:
        pending = guest_rsvp.start(link.event, language=page_language(request), ip=client_ip(request), **form)
    except ApiError as error:
        return event_page(request, code, step="form", error=error.detail.code, form=form, status=400)
    return event_page(request, code, step="verify", pending=pending, form=form)


@require_POST
def rsvp_verify(request, code):
    link = _link_or_404(code)
    if link.revoked_at is not None:
        return _render(request, "web/expired.html", {}, status=410)
    pending = request.POST.get("pending", "")
    try:
        rsvp = guest_rsvp.verify(link.event, pending, request.POST.get("code"))
    except ApiError as error:
        step = "form" if error.detail.code in ("code_expired", "too_many_attempts", "rsvp_removed") else "verify"
        return event_page(request, code, step=step, error=error.detail.code, pending=pending, status=400)
    response = redirect(f"/e/{code}")
    sign_in(response, rsvp.guest)
    return response


@require_POST
def rsvp_cancel(request, code):
    link = _link_or_404(code)
    rsvp = _active_rsvp(current_guest(request), link.event)
    if rsvp is not None:
        guest_rsvp.cancel(rsvp)
    return redirect(f"/e/{code}")


def calendar_file(request, code):
    """An .ics file for the guest's calendar: only for a guest who has RSVP'd."""
    link = _link_or_404(code)
    event = link.event
    if _active_rsvp(current_guest(request), event) is None:
        raise Http404
    calendar = icalendar.Calendar()
    calendar.add("prodid", f"-//{settings.APP_NAME}//events//EN")
    calendar.add("version", "2.0")
    item = icalendar.Event()
    item.add("uid", f"event-{event.pk}@{settings.APP_BUNDLE_ID}")
    item.add("summary", event.title)
    item.add("dtstart", event.starts_at)
    item.add("dtend", event_end(event))
    item.add("location", event.location_text)
    item.add("url", f"{settings.PUBLIC_BASE_URL}/e/{code}")
    item.add("dtstamp", timezone.now())
    calendar.add_component(item)
    response = HttpResponse(calendar.to_ical(), content_type="text/calendar")
    response["Content-Disposition"] = 'attachment; filename="event.ics"'
    return response


# ---- "Can't make it?" from the reminder text ----------------------------------------


def cant_make_it(request, token):
    """One tap, no sign-in: the signed token is tied to that one RSVP."""
    try:
        rsvp_id = signing.loads(token, salt=CANT_MAKE_IT_SALT)
    except signing.BadSignature:
        raise Http404 from None
    rsvp = GuestRSVP.objects.filter(pk=rsvp_id).select_related("event").first()
    if rsvp is None:
        raise Http404
    title, _description = _in_language(rsvp.event, page_language(request))
    done = not rsvp.is_active
    if request.method == "POST" and rsvp.is_active:
        guest_rsvp.cancel(rsvp)
        done = True
    return _render(request, "web/cant_make_it.html", {"title": title, "done": done, "token": token})


# ---- Collect your badge ---------------------------------------------------------------


def collect_page(request, token):
    pending = PendingAttendance.objects.filter(claim_token=token).select_related("rsvp__event").first()
    if pending is None:
        raise Http404
    title, _description = _in_language(pending.rsvp.event, page_language(request))
    context = {
        "title": title,
        "claim_code": pending.claim_code,
        "claimed": pending.claimed_at is not None,
        "expired": timezone.now() > pending.expires_at,
        "expires": timezone.localtime(pending.expires_at),
        "app_link": f"{settings.APP_SCHEME}://c/{token}",
        "ios_store_url": settings.IOS_STORE_URL,
        "android_store_url": settings.ANDROID_STORE_URL,
    }
    return _render(request, "web/collect.html", context)


# ---- The landing page and deep-link files -------------------------------------------


def landing(request):
    return _render(
        request,
        "web/landing.html",
        {"ios_store_url": settings.IOS_STORE_URL, "android_store_url": settings.ANDROID_STORE_URL},
    )


def apple_app_site_association(request):
    """Lets iPhones open globeville.app/e/... and /c/... links straight in the app."""
    app_id = f"{settings.APPLE_TEAM_ID}.{settings.APP_BUNDLE_ID}"
    data = {
        "applinks": {
            "details": [{"appIDs": [app_id], "components": [{"/": "/e/*"}, {"/": "/c/*"}]}],
        }
    }
    return JsonResponse(data)


def android_asset_links(request):
    """The same for Android (App Links)."""
    data = [
        {
            "relation": ["delegate_permission/common.handle_all_urls"],
            "target": {
                "namespace": "android_app",
                "package_name": settings.APP_BUNDLE_ID,
                "sha256_cert_fingerprints": [settings.ANDROID_CERT_SHA256] if settings.ANDROID_CERT_SHA256 else [],
            },
        }
    ]
    return JsonResponse(data, safe=False)
