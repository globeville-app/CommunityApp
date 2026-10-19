from django.contrib import admin
from rest_framework.authtoken.models import TokenProxy

# DRF's "Tokens" screen lists every member's login token, which would let
# anyone with admin access sign in as that member. The team never needs it.
admin.site.unregister(TokenProxy)
