# District Flatwater Fishing 3.2.0 — Metadata review & Diagnostics tab

## New catch-photo workflow

1. Choose an existing photo or take a photo.
2. The app reads original photo metadata **on the device, before compressing the image**. It does not upload EXIF data.
3. If EXIF provides capture date/time or GPS coordinates, the app shows them in **Original photo metadata**. Press **Use photo date & GPS** to apply the available fields.
4. Press **Keep phone values** to leave existing form values alone. Use **Capture GPS & weather** when you want the phone's **current** location and model weather.
5. If the photo has no EXIF or a picker removes it, the app says so and continues to allow manual date/time and live GPS. No invented coordinates.
6. Review the time, GPS and weather before saving. Photo time without a timezone is treated as camera-local wall time; images taken in another time zone may need manual correction.
7. For older photos, today's weather is **not** weather at the photo's original capture time; no historical weather is inferred.
8. Gemini and manual species identification continue to work as before.

The saved catch record still uses the same local IndexedDB name and `catches` object store, and retains its prior fields. Two optional informational fields (`timeSource`, `locationSource`) identify when values came from photo EXIF. Old catches and existing JSON backups remain readable. The app does not erase any old catch or migrate the database.

## Diagnostics

A **Diagnostics** tab replaces the prominent top-of-screen Android diagnostic banner. On Android it contains the same read-only system checks and temporary photo Blob storage probe. Errors appear in the Diagnostics tab instead of Settings.

## Test before regular use

- Test an original JPEG photo from a camera with location tagging turned on. Confirm that its original EXIF date and GPS appear and **do not apply until you tap**.
- Apply the metadata, verify the log form, save a test catch, reopen, and check Gallery details.
- Test a photo without EXIF; confirm no fake GPS/time is assigned and that manual time plus phone GPS still works.
- Confirm diagnostics is absent from the top of the app and appears under its own tab, and its safe checks still pass.
- Verify an existing saved catch still appears in Gallery, with its photo and GPS.
- Build the signed APK using the same GitHub Actions secrets and install **over** the current release. Do not uninstall or clear storage.
- Verify Gemini, local catch data, photo selection and all previous functionality.

Android Camera/image-picker implementations may strip EXIF; in that case the app reports that metadata is unavailable rather than fabricating values. No cloud EXIF service is used.

## Release procedure

Merge this PR after review, run a **new** `Build District Flatwater Fishing APK` workflow on `main`, download `DistrictFlatwaterFishing-Signed-Release-APK`, and install it as an update using the existing permanent signing key. Confirm the unit test and signature verification steps pass. The displayed app version is 3.2.0.
