from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework.exceptions import ErrorDetail

from .models import Account

User = get_user_model()


def normalize_email(email):
    """Emails are case-insensitive in practice; store and compare lowercase."""
    return email.strip().lower()


class SignupSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    language = serializers.ChoiceField(
        choices=settings.LANGUAGES_AVAILABLE, required=False, default=settings.DEFAULT_LANGUAGE_CODE
    )

    def validate_email(self, value):
        email = normalize_email(value)
        if User.objects.filter(username=email).exists():
            raise serializers.ValidationError("email_taken", code="email_taken")
        return email

    def validate(self, data):
        # Django's built-in password rules: long enough, not too common,
        # not all numbers, not too similar to the email.
        candidate = User(username=data["email"], email=data["email"])
        try:
            validate_password(data["password"], user=candidate)
        except DjangoValidationError as error:
            # Keep Django's codes (password_too_short, password_too_common,
            # ...) so the app can explain each rule in the person's language.
            raise serializers.ValidationError(
                {"password": [ErrorDetail(e.code or "invalid", code=e.code or "invalid") for e in error.error_list]}
            )
        return data

    def create(self, validated_data):
        # The email is also the username, because Django's built-in user
        # needs a username and we don't want to ask for one.
        user = User.objects.create_user(
            username=validated_data["email"],
            email=validated_data["email"],
            password=validated_data["password"],
        )
        Account.objects.create(user=user, language=validated_data["language"])
        return user


class DeleteAccountSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class LoginSerializer(serializers.Serializer):
    email = serializers.CharField(max_length=254)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
