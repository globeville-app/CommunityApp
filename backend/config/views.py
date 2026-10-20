from django.conf import settings

from events.categories import config_json
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
def app_config(request):
    """Public settings the app needs before anyone logs in."""
    return Response(
        {
            "app_name": settings.APP_NAME,
            "languages": settings.LANGUAGES_AVAILABLE,
            # Older app versions are asked to update ("" = no minimum). Set
            # MIN_APP_VERSION before shipping a server change old apps can't handle.
            "min_app_version": settings.MIN_APP_VERSION,
            # Event categories, also used for interests.
            **config_json(),
        }
    )
