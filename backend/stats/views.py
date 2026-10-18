from django.contrib import admin
from django.contrib.admin.views.decorators import staff_member_required
from django.shortcuts import render

from .numbers import all_numbers


@staff_member_required
def owner_stats(request):
    """The owner stats page, inside Django admin (staff only)."""
    context = {**admin.site.each_context(request), "title": "Owner stats", **all_numbers()}
    return render(request, "stats/owner_stats.html", context)
