"""
The privacy policy, terms of use and account-deletion page, in English and
Spanish, at /privacy, /terms and /delete-account on the public domain. The
app links to them (privacy_url and terms_url in shared/app_config.json), and
the stores need the URLs.

The facts only the owner can give (who runs the app, a contact email, a
mailing address, the effective date) are in the "legal" section of
shared/app_config.json. Until they're all filled in, every page says it's a
draft, and the missing ones show as "[to be filled in]".
"""

from django.conf import settings
from django.http import Http404
from django.utils import translation

from .views import _render, page_language

DOCUMENTS = {
    "privacy": {"en": "Privacy Policy", "es": "Política de privacidad"},
    "terms": {"en": "Terms of Use", "es": "Términos de uso"},
    "delete_account": {"en": "Delete your account", "es": "Eliminar tu cuenta"},
}
OWNER_FACTS = ["operator", "contact_email", "mailing_address", "effective_date"]
MISSING = {"en": "[to be filled in]", "es": "[por completar]"}


def legal_facts(language):
    facts = {key: settings.LEGAL.get(key, "") for key in [*OWNER_FACTS, "minimum_age", "governing_state"]}
    is_draft = any(not facts[key] for key in OWNER_FACTS)
    for key in OWNER_FACTS:
        facts[key] = facts[key] or MISSING[language]
    return facts, is_draft


def legal_page(request, document):
    if document not in DOCUMENTS:
        raise Http404
    language = page_language(request)
    facts, is_draft = legal_facts(language)
    with translation.override(language):
        return _render(
            request,
            f"web/legal/{document}_{language}.html",
            {"legal": facts, "is_draft": is_draft, "doc_name": DOCUMENTS[document][language]},
        )
