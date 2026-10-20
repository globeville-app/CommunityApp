from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin
from rest_framework.authtoken.models import TokenProxy

from .deletion import delete_member

# DRF's "Tokens" screen lists every member's login token, which would let
# anyone with admin access sign in as that member. The team never needs it.
admin.site.unregister(TokenProxy)


class MemberUserAdmin(UserAdmin):
    """Deleting someone here cleans up exactly like "Delete account" in the app."""

    def delete_model(self, request, obj):
        delete_member(obj)

    def delete_queryset(self, request, queryset):
        for user in queryset:
            delete_member(user)


admin.site.unregister(get_user_model())
admin.site.register(get_user_model(), MemberUserAdmin)
