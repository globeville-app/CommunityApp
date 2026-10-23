"""The app's side of guests: claiming a badge collected as a guest (docs/MILESTONE_5.md)."""

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from badges.views import celebration_json
from events.views import member_profile

from .claims import claim


class ClaimView(APIView):
    throttle_scope = "auth"  # codes are short, so tries are limited like logins

    def post(self, request):
        """{"token": ...} from the collect link, or {"code": ...} typed in. Returns the new celebrations."""
        member_profile(request)  # they've finished joining
        celebrations = claim(request.user, token=request.data.get("token"), code=request.data.get("code"))
        return Response({"celebrations": [celebration_json(c) for c in celebrations]}, status=status.HTTP_201_CREATED)
