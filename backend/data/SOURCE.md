# Neighborhood data source

**File:** `denver_statistical_neighborhoods.geojson` (in this folder)

> **Status: not downloaded yet.** The build environment couldn't reach Denver's
> open-data sites. Download the file using the steps below, then fill in the
> details at the bottom of this page.

## What it is

The City and County of Denver's official **Statistical Neighborhoods** boundary
layer: 78 neighborhoods covering Denver proper. Suburbs with "Denver" mailing
addresses (Aurora, Lakewood, Englewood) are not in it, which is what we want.

Do not substitute another dataset. The neighborhood IDs and names come from this file.

## How to download it

1. Go to Denver's Open Data Catalog: <https://opendata-geospatialdenver.hub.arcgis.com/>
   (also linked from <https://www.denvergov.org/opendata>).
2. Search for **Statistical Neighborhoods**.
3. Choose **Download → GeoJSON**. GeoJSON from the hub is already in WGS84
   (EPSG:4326, plain latitude/longitude), which is what we need.
4. Save it here as `denver_statistical_neighborhoods.geojson`.
5. Check it: from `backend/`, run `python manage.py test neighborhoods`. The
   data tests confirm 78 named neighborhoods with valid shapes.
6. Run `python manage.py load_neighborhoods`.
7. Fill in the details below and commit both files.

The code expects each feature to have `NBHD_ID` and `NBHD_NAME` properties
(Denver's field names). If the city has renamed them, update `ID_FIELDS` and
`NAME_FIELDS` in `neighborhoods/geo.py`.

## Details (fill in after downloading)

- **Page URL:**
- **Download URL:**
- **Downloaded on:**
- **License:** (shown on the dataset page; Denver's open data is usually CC BY 3.0)
