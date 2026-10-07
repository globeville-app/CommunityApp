# Neighborhood data source

**File:** `denver_statistical_neighborhoods.geojson` (in this folder)

> **Status: downloaded 2026-10-07.** The owner exported GeoJSON from the
> dataset page below and pasted it in; it was checked as complete and
> unchanged (valid JSON, 78 features, IDs 1–78, EPSG:4326) before saving.

## What it is

The City and County of Denver's official **Statistical Neighborhoods** boundary
layer: 78 neighborhoods covering Denver proper. Suburbs with "Denver" mailing
addresses (Aurora, Lakewood, Englewood) are not in it, which is what we want.

Do not substitute another dataset. The neighborhood IDs and names come from this file.

## How to download it

1. Open the dataset page:
   <https://opendata-geospatialdenver.hub.arcgis.com/datasets/3e57d472afbf4326867c1a4c9d4e7c91_13/explore>
   (in Denver's Open Data Catalog, titled "Statistical Neighborhood", 78 records).
2. Choose **Download**.
3. Under **GeoJSON**, choose **Download**. Download links the site generates
   expire after about an hour, so record the page above, not the download link.
   GeoJSON from the hub is already in WGS84 (EPSG:4326, plain latitude/longitude),
   which is what we need.
4. Save it here as `denver_statistical_neighborhoods.geojson`.
5. Check it: from `backend/`, run `python manage.py test neighborhoods`. The
   data tests confirm 78 named neighborhoods with valid shapes.
6. Run `python manage.py load_neighborhoods`.
7. Fill in the details below and commit both files.

The code expects each feature to have `NBHD_ID` and `NBHD_NAME` properties
(Denver's field names). If the city has renamed them, update `ID_FIELDS` and
`NAME_FIELDS` in `neighborhoods/geo.py`.

## Known quirk in the city's file

Virginia Village (`NBHD_ID` 69) has a small hole (about 14 acres, centered
near 39.6810, -104.9096, belonging to no Denver neighborhood) stored as a
separate piece instead of as a hole in its main shape. That makes the shape
technically invalid. We do **not** edit the file: `neighborhoods/geo.py`
repairs it in memory when loading (`repair_shape`), and tests confirm the
repaired shape matches the city's drawing (outlines clockwise, holes
counter-clockwise). If a future download fixes this, the repair simply
does nothing.

## Details

- **Page URL:** <https://opendata-geospatialdenver.hub.arcgis.com/datasets/3e57d472afbf4326867c1a4c9d4e7c91_13/explore>
- **Dataset:** Statistical Neighborhood (item `3e57d472afbf4326867c1a4c9d4e7c91`, layer 13;
  the export is named `ODC_ADMN_NEIGHBORHOOD_A`)
- **Downloaded on:** 2026-10-07
- **Fields used:** `NBHD_ID`, `NBHD_NAME` (others kept as-is: `OBJECTID`, `TYPOLOGY`, `NOTES`, `GLOBALID`)
- **License / use constraints** (from the dataset page's About section, 2026-10-07):
  no named license is shown. The page states these use constraints:

  > The City and County of Denver is not responsible and shall not be liable to any user or
  > recipient for damages of any kind arising out of the use of data or information provided by
  > the City and County of Denver, including the installation of the data or information, its use,
  > or the results obtained from its use. ANY DATA OR INFORMATION PROVIDED BY THE City and County of
  > Denver IS PROVIDED AS IS WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESSED OR IMPLIED, AND THE
  > RECIPIENT HEREBY WAIVES ANY AND ALL SUCH WARRANTIES, INCLUDING, BUT NOT LIMITED TO, ANY WARANTY AS
  > TO THE ACCURACY OR COMPLETENESS OF THE INFORMATION AND THE IMPLIED WARRANTIES OF MERCHANTABILITY
  > AND FITNESS FOR A PARTICULAR PURPOSE. Data or information provided by the City and County of
  > Denver shall be used and relied upon only at the user's sole risk, and the user agrees to
  > indemnify and hold harmless the City and County of Denver, its officials, officers and employees
  > from any liability arising out of the use, reproduction or dissemination of the
  > data/information provided. NOT FOR ENGINEERING PURPOSES

  In plain terms: the data is free to use as-is, with no accuracy guarantee, and
  the user (us) takes responsibility for how it's used. Worth a lawyer's look
  before launch, alongside the other open items (see docs/MILESTONE_1.md).
