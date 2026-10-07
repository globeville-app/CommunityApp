from django.contrib import admin

from .models import Neighborhood, NeighborhoodMatch


@admin.register(Neighborhood)
class NeighborhoodAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "source_version")
    search_fields = ("name",)


@admin.register(NeighborhoodMatch)
class NeighborhoodMatchAdmin(admin.ModelAdmin):
    list_display = ("user", "neighborhood", "matched_at")
