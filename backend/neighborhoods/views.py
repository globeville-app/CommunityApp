"""
POST /api/join/match: address in, neighborhood out.

PRIVACY: the address and its coordinates live only in local variables of
this request. They are never saved, logged, or sent back. Only the
neighborhood is remembered (in NeighborhoodMatch).
"""

import logging

from django.conf import settings
from django.utils.decorators import method_decorator
from django.views.decorators.debug import sensitive_post_parameters, sensitive_variables
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from config.errors import ApiError
from geocoding.client import GeocoderUnavailable, geocode

from .aliases import aliases_for, get_alias_map
from .geo import NeighborhoodDataError, get_boundaries
from .models import Neighborhood, NeighborhoodMatch

logger = logging.getLogger(__name__)


class MatchRequestSerializer(serializers.Serializer):
    # Unit/apartment numbers are fine; the geocoder ignores them for matching.
    address = serializers.CharField(max_length=300)


# The four outcomes, as (code, message, HTTP status).
NO_MATCH = (
    "no_match",
    "We couldn't find that address. Check the spelling and try again.",
    status.HTTP_400_BAD_REQUEST,
)
GEOCODER_DOWN = (
    "geocoder_unavailable",
    "We can't look up addresses right now. Please try again in a minute.",
    status.HTTP_503_SERVICE_UNAVAILABLE,
)
SERVER_PROBLEM = (
    "server_error",
    "Something went wrong on our side. Please try again.",
    status.HTTP_500_INTERNAL_SERVER_ERROR,
)


def outside_denver():
    return (
        "outside_denver",
        f"{settings.APP_NAME} is only in the City and County of Denver for now.",
        status.HTTP_400_BAD_REQUEST,
    )


@sensitive_variables("address", "location", "lat", "lon")
def find_neighborhood(address):
    """
    Address → Neighborhood row, or an error tuple from the list above.

    `sensitive_variables` hides these values from Django's error pages.
    """
    try:
        location = geocode(address)
    except GeocoderUnavailable:
        return None, GEOCODER_DOWN
    if location is None:
        return None, NO_MATCH

    lat, lon = location
    area = get_boundaries().find(lat, lon)
    if area is None:
        return None, outside_denver()
    return Neighborhood.objects.get(id=area.id), None


@method_decorator(sensitive_post_parameters("address"), name="dispatch")
class MatchView(APIView):
    throttle_scope = "join_match"

    def post(self, request):
        data = MatchRequestSerializer(data=request.data)
        data.is_valid(raise_exception=True)

        try:
            neighborhood, problem = find_neighborhood(data.validated_data["address"])
        except (NeighborhoodDataError, Neighborhood.DoesNotExist):
            logger.error(
                "Neighborhood data isn't set up. See backend/data/SOURCE.md, "
                "then run: python manage.py load_neighborhoods"
            )
            problem = SERVER_PROBLEM
        except Exception as error:  # deliberately broad, see below
            # Any unexpected error here could carry the address or the
            # coordinates in its message. Log only the error's type, never
            # its message, and send a generic reply.
            logger.error("Neighborhood match failed with %s", type(error).__name__)
            problem = SERVER_PROBLEM

        if problem:
            code, message, http_status = problem
            raise ApiError(code, message, status_code=http_status) from None

        NeighborhoodMatch.objects.update_or_create(
            user=request.user, defaults={"neighborhood": neighborhood}
        )
        return Response(
            {
                "neighborhood_id": neighborhood.id,
                "name": neighborhood.name,
                "aliases": aliases_for(neighborhood.name, get_alias_map()),
            }
        )
