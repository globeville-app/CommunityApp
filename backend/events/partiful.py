"""
Prefill from a pasted Partiful link: read the page's og:title.

Fetching a URL from our server is risky if done carelessly, so this only
fetches https pages on partiful.com, never follows a redirect to another
host, gives up after 3 seconds, and stops reading after 500 KB. Anything
unexpected returns None, and the organizer just types the details.
"""

import logging
from html import unescape
from html.parser import HTMLParser
from urllib.parse import urljoin

import httpx

from .validation import is_partiful_url

logger = logging.getLogger(__name__)

TIMEOUT_SECONDS = 3
MAX_BYTES = 500 * 1024
MAX_REDIRECTS = 3


class _OgTitleParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = None

    def handle_starttag(self, tag, attrs):
        if tag != "meta" or self.title is not None:
            return
        attrs = dict(attrs)
        if (attrs.get("property") or attrs.get("name")) == "og:title" and attrs.get("content"):
            self.title = unescape(attrs["content"]).strip()


def _read_limited(response):
    """The body, or None if it's bigger than MAX_BYTES."""
    body = b""
    for chunk in response.iter_bytes():
        body += chunk
        if len(body) > MAX_BYTES:
            return None
    return body


def fetch_og_title(url):
    if not is_partiful_url(url):
        return None
    try:
        with httpx.Client(timeout=TIMEOUT_SECONDS, follow_redirects=False) as client:
            for _ in range(MAX_REDIRECTS + 1):
                with client.stream("GET", url, headers={"Accept": "text/html"}) as response:
                    if response.is_redirect:
                        url = urljoin(url, response.headers.get("location", ""))
                        if not is_partiful_url(url):
                            return None  # never follow a redirect off Partiful
                        continue
                    if response.status_code != 200:
                        return None
                    body = _read_limited(response)
                    if body is None:
                        return None
                    parser = _OgTitleParser()
                    parser.feed(body.decode(response.encoding or "utf-8", errors="replace"))
                    return parser.title or None
    except httpx.HTTPError as error:
        # Only the error type: the URL could identify a private event.
        logger.info("Partiful preview failed with %s", type(error).__name__)
    return None
