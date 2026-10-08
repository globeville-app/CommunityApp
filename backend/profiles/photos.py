"""
Checking and cleaning uploaded profile photos.

PRIVACY: photos from phones carry EXIF metadata, which can include the GPS
location where the photo was taken (often someone's home). We copy only the
pixels into a brand-new image, so EXIF, GPS, XMP and comments are all left
behind. This happens on the server no matter what the app did.
"""

import io

from django.conf import settings
from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError

ALLOWED_FORMATS = {"JPEG": ".jpg", "PNG": ".png"}
# Big enough for any profile screen, small enough to keep storage sane.
MAX_SIDE_PIXELS = 2048


class PhotoError(Exception):
    """A code such as "photo_too_large"; the app explains it to the person."""

    def __init__(self, code):
        super().__init__(code)
        self.code = code


def clean_photo(upload):
    """
    Check an uploaded file and return a ContentFile of the cleaned image.
    Raises PhotoError with a code if the file isn't acceptable.
    """
    if upload.size > settings.PHOTO_MAX_BYTES:
        raise PhotoError("photo_too_large")

    try:
        image = Image.open(upload)
        image_format = image.format
        if image_format not in ALLOWED_FORMATS:
            raise PhotoError("photo_wrong_type")
        image.load()
    except PhotoError:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError):
        raise PhotoError("photo_wrong_type") from None

    # Phones often save photos sideways and use an EXIF "orientation" flag to
    # say which way is up. Apply it now, because the flag is about to go.
    image = ImageOps.exif_transpose(image)
    image.thumbnail((MAX_SIDE_PIXELS, MAX_SIDE_PIXELS))

    if image_format == "JPEG":
        image = image.convert("RGB")
    elif image.mode not in ("RGB", "RGBA", "L", "LA"):
        image = image.convert("RGBA")

    # A fresh image has no metadata at all; paste in just the pixels.
    clean = Image.new(image.mode, image.size)
    clean.paste(image)

    output = io.BytesIO()
    if image_format == "JPEG":
        clean.save(output, format="JPEG", quality=90)
    else:
        clean.save(output, format="PNG")
    return ContentFile(output.getvalue(), name=f"photo{ALLOWED_FORMATS[image_format]}")
