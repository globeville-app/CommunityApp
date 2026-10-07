from django.conf import settings
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
            "interests": settings.INTEREST_CHOICES,
        }
    )
