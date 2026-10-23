"""US mobile numbers: one standard form (E.164, like +13035550123) for storing and comparing."""

import phonenumbers


class NotUSNumber(Exception):
    pass


def normalize_us(raw):
    """'(303) 555-0123' → '+13035550123'. Raises NotUSNumber for anything else."""
    try:
        number = phonenumbers.parse(str(raw or ""), "US")
    except phonenumbers.NumberParseException:
        raise NotUSNumber() from None
    if phonenumbers.region_code_for_number(number) != "US" or not phonenumbers.is_valid_number(number):
        raise NotUSNumber()
    return phonenumbers.format_number(number, phonenumbers.PhoneNumberFormat.E164)
