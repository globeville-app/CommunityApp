from django.contrib import admin
from django.shortcuts import render

from config.throttling import client_ip

from .numbers import all_numbers


def owner_stats(request):
    """
    The owner stats page, inside Django admin. config/urls.py wraps it in
    admin's own login check (staff only, plus the two-step code when on).
    """
    context = {**admin.site.each_context(request), "title": "Owner stats", **all_numbers()}
    # Lets the owner confirm, after a deploy, that rate limits see real
    # addresses rather than the host's proxy (README, "Going live").
    context["your_address"] = client_ip(request)
    return render(request, "stats/owner_stats.html", context)
