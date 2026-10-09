"""Partiful link preview. The network is always mocked: no real calls."""

from unittest import mock

import httpx

from events import partiful
from events.tests.helpers import EventTestCase

PAGE = '<html><head><meta property="og:title" content="Fall Potluck &amp; Games"></head></html>'


def fake_transport(handler):
    """Make httpx.Client use `handler` instead of the network."""
    real_client = httpx.Client

    def make_client(*args, **kwargs):
        return real_client(*args, transport=httpx.MockTransport(handler), **kwargs)

    return mock.patch.object(partiful.httpx, "Client", side_effect=make_client)


class PartifulPreviewTests(EventTestCase):
    def preview(self, url):
        return self.client.post("/api/events/partiful-preview", {"url": url}, format="json").data

    def test_allowlisted_url_returns_the_title_and_a_suggestion(self):
        seen = []

        def handler(request):
            seen.append(str(request.url))
            return httpx.Response(200, html=PAGE)

        with fake_transport(handler):
            data = self.preview("https://partiful.com/e/abc123")
        self.assertEqual(data, {"title": "Fall Potluck & Games", "suggested_category": "potluck"})
        self.assertEqual(seen, ["https://partiful.com/e/abc123"])

    def test_spanish_title_suggests_a_category(self):
        page = '<meta property="og:title" content="Gran limpieza del callejón">'
        with fake_transport(lambda request: httpx.Response(200, html=page)):
            data = self.preview("https://www.partiful.com/e/xyz")
        self.assertEqual(data, {"title": "Gran limpieza del callejón", "suggested_category": "cleanup"})

    def test_title_without_a_match_has_no_suggestion(self):
        page = '<meta property="og:title" content="Saturday at Ana\'s">'
        with fake_transport(lambda request: httpx.Response(200, html=page)):
            self.assertEqual(self.preview("https://partiful.com/e/1"),
                             {"title": "Saturday at Ana's", "suggested_category": None})

    def test_empty_results(self):
        empty = {"title": None, "suggested_category": None}
        calls = []

        def handler(request):
            calls.append(str(request.url))
            return httpx.Response(200, html=PAGE)

        with fake_transport(handler):
            for url in ["https://evil.com/e/1", "http://partiful.com/e/1", "partiful.com/e/1", "", "ftp://partiful.com"]:
                with self.subTest(url=url):
                    self.assertEqual(self.preview(url), empty)
        self.assertEqual(calls, [])  # nothing was fetched

    def test_redirects_only_within_partiful(self):
        def handler(request):
            if request.url.path == "/e/short":
                return httpx.Response(302, headers={"Location": "https://www.partiful.com/e/full"})
            if request.url.path == "/e/away":
                return httpx.Response(302, headers={"Location": "https://evil.example.com/steal"})
            if request.url.host == "evil.example.com":
                raise AssertionError("followed a redirect off Partiful")
            return httpx.Response(200, html=PAGE)

        with fake_transport(handler):
            self.assertEqual(self.preview("https://partiful.com/e/short")["title"], "Fall Potluck & Games")
            self.assertEqual(self.preview("https://partiful.com/e/away"),
                             {"title": None, "suggested_category": None})

    def test_timeouts_errors_and_oversized_pages(self):
        def timeout(request):
            raise httpx.ReadTimeout("slow", request=request)

        big = '<meta property="og:title" content="Too big">' + "x" * (600 * 1024)
        handlers = [
            timeout,
            lambda request: httpx.Response(404),
            lambda request: httpx.Response(200, content=big.encode()),
            lambda request: httpx.Response(200, html="<html>no title here</html>"),
        ]
        for handler in handlers:
            with self.subTest(handler=handler), fake_transport(handler):
                self.assertEqual(self.preview("https://partiful.com/e/1"),
                                 {"title": None, "suggested_category": None})

    def test_uses_a_3_second_timeout_and_no_automatic_redirects(self):
        with fake_transport(lambda request: httpx.Response(200, html=PAGE)) as client_class:
            self.preview("https://partiful.com/e/1")
        kwargs = client_class.call_args.kwargs
        self.assertEqual(kwargs["timeout"], 3)
        self.assertIs(kwargs["follow_redirects"], False)
