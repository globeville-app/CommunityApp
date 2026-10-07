from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

User = get_user_model()


def normalize_email(email):
    """Emails are case-insensitive in practice; store and compare lowercase."""
    return email.strip().lower()


class SignupSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_email(self, value):
        email = normalize_email(value)
        if User.objects.filter(username=email).exists():
            raise serializers.ValidationError("An account with this email already exists. Try logging in.")
        return email

    def validate(self, data):
        # Django's built-in password rules: long enough, not too common,
        # not all numbers, not too similar to the email.
        candidate = User(username=data["email"], email=data["email"])
        try:
            validate_password(data["password"], user=candidate)
        except DjangoValidationError as error:
            raise serializers.ValidationError({"password": list(error.messages)})
        return data

    def create(self, validated_data):
        # The email is also the username, because Django's built-in user
        # needs a username and we don't want to ask for one.
        return User.objects.create_user(
            username=validated_data["email"],
            email=validated_data["email"],
            password=validated_data["password"],
        )


class LoginSerializer(serializers.Serializer):
    email = serializers.CharField(max_length=254)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
