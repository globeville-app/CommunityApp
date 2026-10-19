"""
One shape for every API error: {"code": "some_code"}, plus "fields" for form
errors: {"code": "email_taken", "fields": {"email": ["email_taken"]}}.

The server never sends sentences for people to read. The app turns each code
into a message in the person's language (mobile/src/i18n/*.json, under
"errors"), and shows a generic message for any code it doesn't know.
"""

from django.http import JsonResponse
from django.views import defaults
from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler

# DRF's built-in field codes say *what* went wrong but not *where* ("blank",
# "invalid"). For these, the top-level code names the field instead, e.g.
# "invalid_email" or "invalid_first_name", so the app can say something useful.
GENERIC_FIELD_CODES = {
    "invalid",
    "required",
    "blank",
    "null",
    "max_length",
    "min_length",
    "max_value",
    "min_value",
    "invalid_choice",
    "not_a_list",
    "empty",
}


class ApiError(APIException):
    """Raise this from a view to send an error code the app can translate."""

    def __init__(self, code, status_code=status.HTTP_400_BAD_REQUEST):
        self.status_code = status_code
        # DRF needs some detail text; it's only used in server logs.
        super().__init__(detail=code, code=code)


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        # Not an API error (a real bug). Django will return a 500 and log the
        # traceback. Views that handle private data catch their own errors
        # first, so no address can end up in that traceback.
        return None

    # "Try again in N seconds" (429), how to log in (401), allowed methods (405).
    headers = {name: response[name] for name in KEPT_HEADERS if name in response}

    if isinstance(exc, ValidationError):
        fields = _field_codes(exc.get_codes())
        return Response({"code": _top_code(fields), "fields": fields}, status=response.status_code, headers=headers)

    # ApiError and DRF's built-in errors (not logged in, throttled, ...).
    codes = exc.get_codes() if hasattr(exc, "get_codes") else "error"
    code = codes if isinstance(codes, str) else "error"
    return Response({"code": code}, status=response.status_code, headers=headers)


KEPT_HEADERS = ("Retry-After", "WWW-Authenticate", "Allow")


# Django's own error pages (config/urls.py), for addresses no API view
# handles and for crashes. The app gets the same {"code": ...} shape as
# every other error; the admin keeps Django's normal pages.
def _is_api(request):
    return request.path.startswith("/api/")


def not_found(request, exception=None):
    if _is_api(request):
        return JsonResponse({"code": "not_found"}, status=404)
    return defaults.page_not_found(request, exception)


def server_error(request):
    if _is_api(request):
        return JsonResponse({"code": "server_error"}, status=500)
    return defaults.server_error(request)


def _field_codes(codes):
    """{"email": ["invalid"]} with nested lists flattened; a bare list → "non_field"."""
    if isinstance(codes, dict):
        return {field: _flatten(value) for field, value in codes.items()}
    return {"non_field": _flatten(codes)}


def _flatten(value):
    if isinstance(value, dict):
        return [code for item in value.values() for code in _flatten(item)]
    if isinstance(value, list):
        return [code for item in value for code in _flatten(item)]
    return [str(value)]


def _top_code(fields):
    for field, codes in fields.items():
        for code in codes:
            if code not in GENERIC_FIELD_CODES:
                return code
        if codes and field not in ("non_field", "non_field_errors"):
            return f"invalid_{field}"
    return "invalid"
