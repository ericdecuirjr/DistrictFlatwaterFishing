# District Flatwater Fishing v3.3.0 — Historical Catch Weather

This feature enriches older catch photos with model-estimated historical weather for the photo's original time and GPS coordinates.

## How to use

1. Open **Log catch** and choose a photo with EXIF date and GPS metadata.
2. Review and tap **Use photo date & GPS**. If EXIF is missing, enter the correct catch date and use an available location (a phone GPS fix is *current* location, not proof of historical catch location).
3. In **Historical weather lookup**, tap **Look up historical weather**. This is an explicit network request.
4. Review its **matched sample time**, offset from requested time, temperature (°F), surface pressure (inHg), conditions, and source.
5. Tap **Use historical weather** or **Discard result**.
6. Save the catch. Existing catch logs can also be edited to add historical conditions.
7. Reopen the saved record in Gallery: weather source and historical hour are visible.

## Safety and scope

- Historical lookup sends only coordinates and a narrow date range to Open-Meteo's public archive API. Photographs, Gemini API keys, and catch records are not uploaded.
- Data are **model/reanalysis estimates**, not instrument observations at your exact fishing spot. Not all historical times/places have usable measurements.
- The closest UTC hourly sample is used only when within one hour. A capture date lacking timezone information may be wrong if the camera's time zone differs from the phone's local zone; review before applying.
- The old Current Weather button still retrieves present-time forecast data. It can overwrite the draft's historical weather deliberately.
- The lookup does **not** save or change any catch records until you explicitly apply the preview and press Save/Update catch.
- If a request fails, records remain unchanged. In-flight requests are abandoned if the user changes photo, location, time, or resets the form.
- No IndexedDB schema migration, no changes to signing keys or package ID. Existing catches, photo Blobs, exports/imports, Maps, Analytics, Diagnostics, and Gemini stay compatible.

## Test checklist on Galaxy

- Select a JPEG with original EXIF date/GPS and apply it.
- Lookup a photograph from several weeks ago, verify preview values and source; apply, save, close/reopen and confirm history in Gallery.
- Test Discard: no historical conditions applied.
- Test a photo without EXIF, absent GPS, a future date, and a request without internet; app must not invent weather or crash.
- Change the date after a historical preview and confirm old result cannot be applied.
- Confirm previously saved catches, their photos/GPS, Gemini identification, existing current GPS/weather, Analytics/Map, and Diagnostics still work.
- Install the next **signed** APK over the installed release, never uninstall, and verify catch count and existing details remain.

## Release

This branch is a proposed v3.3.0 release. Run the Android build workflow on the feature branch, confirm **test-historical-weather.mjs** and signed APK verification pass, and test on the Galaxy. Then merge into `main` and produce a fresh signed release. The release uses the existing permanent signing secrets.

Provider reference: https://open-meteo.com/en/docs/historical-weather-api
