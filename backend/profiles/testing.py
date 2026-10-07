"""Test helpers: build small images in memory, with or without GPS metadata."""

import io

from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import ExifTags, Image

# A made-up location, in the degrees/minutes/seconds form EXIF uses.
FAKE_GPS = {
    ExifTags.GPS.GPSLatitudeRef: "N",
    ExifTags.GPS.GPSLatitude: (39.0, 45.0, 43.56),
    ExifTags.GPS.GPSLongitudeRef: "W",
    ExifTags.GPS.GPSLongitude: (105.0, 0.0, 37.8),
}


def exif_with_gps(orientation=None):
    exif = Image.Exif()
    exif[ExifTags.Base.Make] = "TestPhone"
    if orientation:
        exif[ExifTags.Base.Orientation] = orientation
    exif.get_ifd(ExifTags.IFD.GPSInfo).update(FAKE_GPS)
    return exif


def image_bytes(fmt="JPEG", size=(40, 20), exif=None, color=(200, 30, 30)):
    image = Image.new("RGB", size, color)
    output = io.BytesIO()
    if exif is not None:
        image.save(output, format=fmt, exif=exif)
    else:
        image.save(output, format=fmt)
    return output.getvalue()


def upload(data, name="photo.jpg", content_type="image/jpeg"):
    return SimpleUploadedFile(name, data, content_type=content_type)
