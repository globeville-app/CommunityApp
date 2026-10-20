"""
The organizations API (docs/MILESTONE_4.md).

Members see an organization only once it's approved and only if it serves
their neighborhood; for anyone else it doesn't exist (404). Its admins can
always see it, whatever its status.
"""

import logging
from datetime import timedelta
from urllib.parse import urlsplit

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from config.errors import ApiError
from events.models import Event
from events.timing import has_ended
from events.translation import TranslationUnavailable, get_translator
from events.views import event_json, events_for, member_profile
from neighborhoods.geo import neighborhood_center
from neighborhoods.models import Neighborhood
from profiles.models import Profile
from profiles.photos import PhotoError, clean_photo

from .models import (
    DESCRIPTION_MAX,
    MAX_ADMINS,
    NAME_MAX,
    TYPES,
    Follow,
    Organization,
    OrganizationAdmin,
    OrganizationChangeRequest,
    OrganizationInvite,
    OrganizationReport,
    OrganizationTranslation,
)

logger = logging.getLogger(__name__)
NOT_FOUND = status.HTTP_404_NOT_FOUND
DAILY_REQUEST_LIMIT = 3
REPORT_REASON_MAX = 200


# ---- Checks --------------------------------------------------------------------


def clean_name(value):
    name = str(value or "").strip()
    if not name:
        raise ApiError("org_name_required")
    if len(name) > NAME_MAX:
        raise ApiError("org_name_too_long")
    return name


def clean_type(value, business_rule_accepted):
    if value not in TYPES:
        raise ApiError("invalid_org_type")
    # Businesses agree to the real-events rule when they ask (or switch).
    if value == "business" and business_rule_accepted is not True:
        raise ApiError("business_rule")
    return value


def clean_neighborhoods(value):
    if not isinstance(value, list) or not value:
        raise ApiError("neighborhoods_required")
    # bool is a subclass of int in Python, so rule it out explicitly (True would mean id 1).
    if any(not isinstance(item, int) or isinstance(item, bool) for item in value):
        raise ApiError("invalid_neighborhood")
    ids = sorted(set(value))
    if Neighborhood.objects.filter(pk__in=ids).count() != len(ids):
        raise ApiError("invalid_neighborhood")
    return ids


def clean_description(value, code="org_description_too_long"):
    text = str(value or "").strip()
    if len(text) > DESCRIPTION_MAX:
        raise ApiError(code)
    return text


def clean_link(value):
    link = str(value or "").strip()
    if not link:
        return ""
    parts = urlsplit(link)
    if parts.scheme != "https" or not parts.hostname or len(link) > 200:
        raise ApiError("invalid_link")
    return link


# ---- Finding one ----------------------------------------------------------------


def visible_orgs(user, profile):
    """Approved ones serving the member's neighborhood, plus any they run."""
    return Organization.objects.filter(
        Q(status=Organization.Status.APPROVED, neighborhoods=profile.neighborhood_id) | Q(admins__user=user)
    ).distinct()


def get_org(request, profile, org_id):
    organization = visible_orgs(request.user, profile).filter(pk=org_id).first()
    if organization is None:
        raise ApiError("org_not_found", status_code=NOT_FOUND)
    return organization


def admin_org(request, profile, org_id):
    organization = get_org(request, profile, org_id)
    if not organization.is_admin(request.user):
        raise ApiError("not_org_admin", status_code=status.HTTP_403_FORBIDDEN)
    return organization


# ---- What the app sees ------------------------------------------------------------


def org_summary(organization, request):
    return {
        "id": organization.pk,
        "name": organization.name,
        "type": organization.type,
        "photo_url": request.build_absolute_uri(organization.photo.url) if organization.photo else None,
    }


def org_json(organization, request, profile):
    from badges.views import badges_json_for_org

    user = request.user
    is_admin = organization.is_admin(user)
    now = timezone.now()
    events = events_for(profile, user).filter(organization=organization, status=Event.Status.ACTIVE)
    if not is_admin:
        # Members see only their own neighborhood's events (no exploring yet).
        events = events.filter(neighborhood_id=profile.neighborhood_id)
    events = list(events.order_by("starts_at", "pk"))
    upcoming = [e for e in events if not has_ended(e, now)]
    data = {
        **org_summary(organization, request),
        "description": organization.description,
        "description_alt": organization.description_alt or None,
        "language": organization.language,
        "link": organization.link or None,
        "neighborhoods": [{"id": n.pk, "name": n.name} for n in organization.neighborhoods.order_by("name")],
        "badges": badges_json_for_org(organization, earned_only=True),
        "upcoming_events": [event_json(e, request, profile, now) for e in upcoming],
        "past_event_count": len(events) - len(upcoming),
        "is_following": Follow.objects.filter(user=user, organization=organization).exists(),
        "is_admin": is_admin,
    }
    if is_admin:
        data.update(
            {
                "status": organization.status,
                # A count only: who follows is private.
                "follower_count": organization.follows.count(),
                "change_pending": organization.change_requests.filter(
                    status=OrganizationChangeRequest.Status.PENDING
                ).exists(),
                # A count only: who was invited stays private until they accept.
                "pending_invites": organization.invites.count(),
                "admins": [
                    {
                        "member_id": getattr(a.user, "profile", None) and a.user.profile.pk,
                        "display_name": a.user.profile.display_name if hasattr(a.user, "profile") else None,
                        "is_you": a.user_id == user.id,
                    }
                    for a in organization.admins.select_related("user__profile").order_by("added_at")
                ],
            }
        )
    return data


# ---- Endpoints ---------------------------------------------------------------------


class OrganizationListView(APIView):
    def get(self, request):
        """Approved organizations serving the member's neighborhood, A–Z. No counts, no ranking."""
        profile = member_profile(request)
        orgs = Organization.objects.filter(status=Organization.Status.APPROVED, neighborhoods=profile.neighborhood_id)
        return Response({"organizations": [org_summary(o, request) for o in orgs.order_by("name")]})

    def post(self, request):
        """Ask for a new organization. It starts as pending, visible only to the asker."""
        profile = member_profile(request)
        data = request.data
        fields = {
            "name": clean_name(data.get("name")),
            "type": clean_type(data.get("type"), data.get("business_rule_accepted")),
            "description": clean_description(data.get("description")),
            "description_alt": clean_description(data.get("description_alt")),
            "language": data.get("language") if data.get("language") in ("en", "es") else "en",
            "link": clean_link(data.get("link")),
        }
        neighborhood_ids = clean_neighborhoods(data.get("neighborhoods"))
        with transaction.atomic():
            # One request at a time per member, so the daily limit holds (review N7).
            get_user_model().objects.select_for_update().filter(pk=request.user.pk).first()
            recent = OrganizationAdmin.objects.filter(
                user=request.user, organization__created_at__gte=timezone.now() - timedelta(days=1)
            ).count()
            if recent >= DAILY_REQUEST_LIMIT:
                raise ApiError("daily_limit", status_code=status.HTTP_429_TOO_MANY_REQUESTS)
            organization = Organization.objects.create(**fields)
            organization.neighborhoods.set(neighborhood_ids)
            # The member who asks becomes its first admin.
            OrganizationAdmin.objects.create(organization=organization, user=request.user)
        return Response(org_json(organization, request, profile), status=status.HTTP_201_CREATED)


class MyOrganizationsView(APIView):
    def get(self, request):
        """The organizations the member runs, with their status and neighborhoods (for "Post as")."""
        member_profile(request)
        orgs = Organization.objects.filter(admins__user=request.user).order_by("name")
        return Response(
            {
                "organizations": [
                    {
                        **org_summary(o, request),
                        "status": o.status,
                        # center: where the pin map opens when posting there.
                        "neighborhoods": [
                            {"id": n.pk, "name": n.name, "center": neighborhood_center(n.pk)}
                            for n in o.neighborhoods.order_by("name")
                        ],
                    }
                    for o in orgs
                ]
            }
        )


class OrganizationDetailView(APIView):
    def get(self, request, org_id):
        profile = member_profile(request)
        return Response(org_json(get_org(request, profile, org_id), request, profile))

    def patch(self, request, org_id):
        """
        Description, its other-language version, the language and the link
        change right away. Name, type and neighborhoods wait for the team.
        """
        profile = member_profile(request)
        organization = admin_org(request, profile, org_id)
        data = request.data
        direct = {}
        if "description" in data:
            direct["description"] = clean_description(data["description"])
        if "description_alt" in data:
            direct["description_alt"] = clean_description(data["description_alt"])
        if data.get("language") in ("en", "es"):
            direct["language"] = data["language"]
        if "link" in data:
            direct["link"] = clean_link(data["link"])

        change = {}
        if "name" in data and clean_name(data["name"]) != organization.name:
            change["name"] = clean_name(data["name"])
        if "type" in data and data["type"] != organization.type:
            change["type"] = clean_type(data["type"], data.get("business_rule_accepted"))
        if "neighborhoods" in data:
            ids = clean_neighborhoods(data["neighborhoods"])
            if ids != sorted(organization.neighborhoods.values_list("pk", flat=True)):
                change["neighborhood_ids"] = ids

        with transaction.atomic():
            if direct:
                for field, value in direct.items():
                    setattr(organization, field, value)
                organization.save(update_fields=[*direct, "updated_at"])
                if {"description", "description_alt", "language"} & set(direct):
                    OrganizationTranslation.objects.filter(organization=organization).delete()
            if change:
                # One pending request at a time: a newer one replaces it.
                OrganizationChangeRequest.objects.filter(
                    organization=organization, status=OrganizationChangeRequest.Status.PENDING
                ).delete()
                OrganizationChangeRequest.objects.create(organization=organization, requested_by=request.user, **change)
        return Response(org_json(organization, request, profile))


class OrganizationPhotoView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request, org_id):
        """Same rules as profile photos: JPEG or PNG, 5 MB, EXIF removed."""
        profile = member_profile(request)
        organization = admin_org(request, profile, org_id)
        upload = request.FILES.get("photo")
        if upload is None:
            raise ApiError("photo_missing")
        try:
            cleaned = clean_photo(upload)
        except PhotoError as error:
            raise ApiError(error.code) from None
        old = organization.photo.name if organization.photo else None
        organization.photo.save(cleaned.name, cleaned, save=True)
        if old:
            organization.photo.storage.delete(old)
        return Response(org_json(organization, request, profile))


class OrganizationAdminsView(APIView):
    throttle_scope = "org_admins"

    def post(self, request, org_id):
        """
        Invite a member, by email, to help run the organization (1-5 admins,
        counting open invitations). They become an admin only by accepting.
        The reply is the same whether or not the email belongs to a member, so
        this can't be used to find out who uses the app (review S2).
        """
        profile = member_profile(request)
        organization = admin_org(request, profile, org_id)
        if organization.status != Organization.Status.APPROVED:
            raise ApiError("org_not_approved")
        email = str(request.data.get("email") or "").strip().lower()
        user = get_user_model().objects.filter(username__iexact=email).first() if email else None
        with transaction.atomic():
            # Locked, so two admins inviting at once can't pass 5 (review N7).
            Organization.objects.select_for_update().filter(pk=organization.pk).first()
            if organization.admins.count() + organization.invites.count() >= MAX_ADMINS:
                raise ApiError("too_many_admins")
            if user is not None and Profile.objects.filter(user=user).exists() and not organization.is_admin(user):
                OrganizationInvite.objects.get_or_create(organization=organization, user=user)
        return Response(org_json(organization, request, profile), status=status.HTTP_202_ACCEPTED)

    def delete(self, request, org_id):
        """Remove an admin (or yourself) by member id. The last admin can't leave."""
        profile = member_profile(request)
        organization = admin_org(request, profile, org_id)
        member_id = request.data.get("member_id")
        row = organization.admins.filter(user__profile__pk=member_id).first() if member_id else None
        if row is None:
            raise ApiError("not_an_admin")
        if organization.admins.count() <= 1:
            raise ApiError("last_admin", status_code=status.HTTP_409_CONFLICT)
        row.delete()
        if row.user_id == request.user.id:
            # They left; they may no longer see a pending organization.
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(org_json(organization, request, profile))


class OrganizationInvitesView(APIView):
    """DELETE: an admin cancels every open invitation (they don't know who they went to)."""

    def delete(self, request, org_id):
        profile = member_profile(request)
        organization = admin_org(request, profile, org_id)
        organization.invites.all().delete()
        return Response(org_json(organization, request, profile))


class MyInvitesView(APIView):
    """The invitations this member got, shown under Your organizations."""

    def get(self, request):
        member_profile(request)
        invites = OrganizationInvite.objects.filter(
            user=request.user, organization__status=Organization.Status.APPROVED
        ).select_related("organization")
        return Response(
            {
                "invites": [
                    {"id": i.pk, "organization": {"id": i.organization_id, "name": i.organization.name}}
                    for i in invites.order_by("created_at")
                ]
            }
        )


class MyInviteView(APIView):
    """PUT = accept (become an admin), DELETE = decline."""

    def _invite(self, request, invite_id):
        invite = OrganizationInvite.objects.filter(pk=invite_id, user=request.user).first()
        if invite is None:
            raise ApiError("invite_not_found", status_code=status.HTTP_404_NOT_FOUND)
        return invite

    def put(self, request, invite_id):
        member_profile(request)
        with transaction.atomic():
            invite = self._invite(request, invite_id)
            organization = Organization.objects.select_for_update().get(pk=invite.organization_id)
            if organization.status != Organization.Status.APPROVED:
                raise ApiError("org_not_approved")
            if organization.admins.count() >= MAX_ADMINS:
                raise ApiError("too_many_admins")
            OrganizationAdmin.objects.get_or_create(organization=organization, user=request.user)
            invite.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def delete(self, request, invite_id):
        self._invite(request, invite_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class FollowView(APIView):
    def _org(self, request):
        profile = member_profile(request)
        organization = get_org(request, profile, self.kwargs["org_id"])
        if organization.status != Organization.Status.APPROVED:
            raise ApiError("org_not_approved", status_code=status.HTTP_409_CONFLICT)
        return organization

    def put(self, request, org_id):
        Follow.objects.get_or_create(user=request.user, organization=self._org(request))
        return Response({"is_following": True})

    def delete(self, request, org_id):
        Follow.objects.filter(user=request.user, organization=self._org(request)).delete()
        return Response({"is_following": False})


class OrganizationReportView(APIView):
    def post(self, request, org_id):
        profile = member_profile(request)
        organization = get_org(request, profile, org_id)
        reason = str(request.data.get("reason") or "").strip()
        if not reason:
            raise ApiError("reason_required")
        if len(reason) > REPORT_REASON_MAX:
            raise ApiError("reason_too_long")
        OrganizationReport.objects.create(organization=organization, reporter=request.user, reason=reason)
        return Response({"ok": True}, status=status.HTTP_201_CREATED)


class OrganizationTranslateView(APIView):
    def post(self, request, org_id):
        """The description in another language: the admins' own version, or a cached machine translation."""
        profile = member_profile(request)
        organization = get_org(request, profile, org_id)
        target = request.data.get("target")
        if target not in ("en", "es"):
            raise ApiError("invalid_language")
        if target == organization.language:
            return Response({"description": organization.description, "target": target, "machine": False})
        if organization.description_alt:
            return Response({"description": organization.description_alt, "target": target, "machine": False})
        cached = OrganizationTranslation.objects.filter(organization=organization, target_language=target).first()
        if cached:
            return Response({"description": cached.text, "target": target, "machine": True})
        translator = get_translator()
        if translator is None:
            raise ApiError("translation_unavailable", status_code=status.HTTP_503_SERVICE_UNAVAILABLE)
        try:
            text = translator.translate(organization.description, organization.language, target)
        except TranslationUnavailable:
            raise ApiError("translation_failed", status_code=status.HTTP_502_BAD_GATEWAY) from None
        OrganizationTranslation.objects.create(organization=organization, target_language=target, text=text)
        return Response({"description": text, "target": target, "machine": True})


class NeighborhoodListView(APIView):
    def get(self, request):
        """All of Denver's neighborhoods, for "Neighborhoods served"."""
        return Response({"neighborhoods": [{"id": n.pk, "name": n.name} for n in Neighborhood.objects.order_by("name")]})
