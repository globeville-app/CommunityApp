"""
Email + password login. The app gets a token and sends it with every request.

All login logic lives in this app, so phone-number login (v2) can be added
here later without touching neighborhoods or profiles.
"""

from django.contrib.auth import authenticate
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from config.errors import ApiError

from .serializers import LoginSerializer, SignupSerializer, normalize_email


class SignupView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token = Token.objects.create(user=user)
        return Response({"token": token.key}, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            request,
            username=normalize_email(serializer.validated_data["email"]),
            password=serializer.validated_data["password"],
        )
        if user is None:
            # Same message whether the email or the password was wrong.
            raise ApiError("invalid_credentials", "Email or password is incorrect.")
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key})


class LogoutView(APIView):
    def post(self, request):
        # Deleting the token means it can never be used again, even if it
        # was copied off the phone.
        request.auth.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
