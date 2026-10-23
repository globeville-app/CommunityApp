"""
Deleting a member: one routine for "Delete account" in the app and for the
team deleting someone in Django admin (review N4), so both clean up the same.

It deletes the member's login, profile, photo file, tokens and everything
else tied to them. Their problem reports are kept so the team can still fix
the bug, but with the user removed and any contact email cleared.

RULE FOR EVERY FUTURE FEATURE (see README): content tied to a deleted member
is either removed or shown as "Former neighbor", never with their name. When
a feature adds data that points at a user, update this function.
"""

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone


def delete_member(user):
    # Imported here to keep the accounts app free of a hard dependency on
    # the apps that store member data.
    from badges.engine import update_badges
    from events.models import Event, InviteLink
    from notifications.scheduling import event_cancelled
    from organizations.models import Organization
    from profiles.models import Profile
    from support.models import ProblemReport

    # Hosts whose numbers include this member, to refresh afterwards.
    hosts = list(
        # Only members' own events: an organization event's host is the organization.
        get_user_model()
        .objects.filter(organized_events__organization__isnull=True, organized_events__attendances__user=user)
        .exclude(pk=user.pk)
        .distinct()
    )
    hosts += list(Organization.objects.filter(events__attendances__user=user).distinct())
    # Organizations they run: if they're the last admin, a live one is
    # hidden until the team assigns a new one (MILESTONE_4.md changes
    # SETTINGS.md). One still waiting for review keeps waiting.
    their_orgs = list(Organization.objects.filter(admins__user=user))

    photo = None
    profile = Profile.objects.filter(user=user).first()
    if profile and profile.photo:
        photo = (profile.photo.storage, profile.photo.name)

    with transaction.atomic():
        ProblemReport.objects.filter(user=user).update(user=None, contact_email="")
        # Their upcoming events are cancelled. Past ones stay, and once the
        # user is gone they show "Former neighbor" as the organizer.
        # Organization events aren't theirs to cancel: they belong to the organization.
        cancelled = list(
            Event.objects.filter(
                organizer=user, organization__isnull=True, starts_at__gt=timezone.now(), status=Event.Status.ACTIVE
            )
        )
        Event.objects.filter(pk__in=[e.pk for e in cancelled]).update(status=Event.Status.CANCELLED)
        # Their invite links stop working too (Milestone 5).
        InviteLink.objects.filter(event__in=cancelled, revoked_at__isnull=True).update(revoked_at=timezone.now())
        # Deleting the user also deletes, through the database: the profile
        # (and its interests), the account settings, the neighborhood match,
        # every login token and email code, their "I'm going" records,
        # attendance, badges, unlock moments, blocks and invitations. Events
        # they organized keep existing with no organizer.
        user.delete()
        # Their attendance drops out of these hosts' counts. Stages are never
        # lowered (badges/engine.py), only the counts change.
        for host in hosts:
            update_badges(host)
        for organization in their_orgs:
            if organization.status == Organization.Status.APPROVED and not organization.admins.exists():
                organization.status = Organization.Status.HIDDEN
                organization.save(update_fields=["status", "updated_at"])

    # Neighbors going to their cancelled events get a notice, and web guests a text.
    for event in cancelled:
        event_cancelled(event)

    # Remove the photo file only once the database change has stuck.
    if photo:
        storage, name = photo
        storage.delete(name)
