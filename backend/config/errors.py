"""
One shape for every API error: {"code": "some_code", "detail": "Message for people."}

The phone shows `detail` to the person and uses `code` to decide what to do
(e.g. "profile_not_found" → go to the Address screen).
"""

from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.views import exception_handler


class ApiError(APIException):
    """Raise this from a view to send a friendly error with a stable code."""

    def __init__(self, code, detail, status_code=status.HTTP_400_BAD_REQUEST):
        self.status_code = status_code
        super().__init__(detail=detail, code=code)


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        # Not an API error (a real bug). Django will return a 500 and log the
        # traceback. Views that handle private data catch their own errors
        # first, so no address can end up in that traceback.
        return None

    if isinstance(exc, ApiError):
        return Response(
            {"code": exc.get_codes(), "detail": str(exc.detail)},
            status=response.status_code,
        )

    data = response.data
    if isinstance(data, dict) and "detail" in data and len(data) == 1:
        # Built-in DRF errors: not logged in, throttled, etc.
        codes = exc.get_codes() if hasattr(exc, "get_codes") else "error"
        code = codes if isinstance(codes, str) else "error"
        return Response({"code": code, "detail": str(data["detail"])}, status=response.status_code)

    # Form validation errors: {"field": ["message", ...]}. Keep the per-field
    # messages so the app can show them, and add a readable summary.
    first_message = _first_message(data)
    return Response(
        {"code": "invalid", "detail": first_message, "fields": data},
        status=response.status_code,
    )


def _first_message(data):
    if isinstance(data, dict):
        for value in data.values():
            return _first_message(value)
    if isinstance(data, list) and data:
        return _first_message(data[0])
    return str(data) if data else "Something went wrong."
