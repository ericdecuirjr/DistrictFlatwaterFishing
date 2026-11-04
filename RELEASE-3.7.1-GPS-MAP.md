# District Flatwater Fishing v3.7.1 — Saved GPS audit and map correction

This hotfix addresses map pins that appeared to represent the phone's location instead of the GPS location associated with each saved catch.

## Root-cause findings

- The map itself reads stored coordinates from the existing IndexedDB `district-flatwater-catches-v1`/`catches` records. It **does not ask Android for the phone's current position**. However, saved records might already contain the phone's GPS from the time they were logged.
- Previously, changing manual latitude/longitude fields and immediately pressing Save Catch without tapping **Use entered GPS** could silently retain the older location already in the draft (often phone GPS).
- The old map did not make the coordinate source obvious, making stored phone-derived locations appear like a map fallback.

## Improvements

1. Map pins are created solely from **saved catch records**. No live GPS calls, no arbitrary world, phone, or regional default map center.
2. The map lists the **exact stored coordinates** (six decimal places), with explicit GPS provenance: **Original Photo EXIF**, **Manual Entry**, **Phone GPS at logging time**, or **Unspecified older record**. A summary counts how many GPS-tagged catches used each source.
3. Each saved catch location has a **Show pin** button. When tapped, the map zooms to those **stored** coordinates and opens the corresponding marker's popup.
4. Each location has an **Edit GPS** button opening the saved catch's editor, making corrections fast.
5. The catch editor now detects manual GPS fields changed since they were populated. **Save Catch** validates and applies those edited decimal coordinates as **manual** GPS, instead of silently writing an older phone location. Invalid or half-entered coordinates block saving with an explanation.
6. Saved catches with no valid GPS show a clear empty state; no substitute location is invented. Multiple catches at one location still share a numbered pin.
7. The previously installed v3.6.1 local Leaflet assets, v3.7.0 sticky banner and two-second in-app splash remain intact.

## Galaxy verification

1. From GitHub Actions build branch `fix-saved-catch-gps-map-audit-v3-7-1`.
2. Confirm all existing source/navigation/map tests pass and the signed APK signature verifies.
3. Install the **Signed-Release-APK** **over** your installed app. Never uninstall or clear storage.
4. Open **Map**. The saved GPS list should show each coordinate pair and its **GPS source**. There should be no prompt to access current GPS simply for viewing the map.
5. Tap **Show pin** beside a saved catch. Check that the pin and popup show exactly its displayed coordinates. Test at least two catches from different geographic locations, if present.
6. If a catch shows the wrong GPS location or `Phone GPS at time of logging`, tap **Edit GPS**, enter the correct photo/catch coordinates, then **Update catch**. You can press Update catch directly after editing the fields; the new coordinates should be saved as manual GPS. Reopen Map to confirm the corrected position and source.
7. Confirm a catch with valid coordinates stays where it was saved, including after app restart and after switching tabs.
8. Confirm Gallery, catch photos, manual/phone GPS capture, Gemini identification, weather, Analytics, Diagnostics, branded splash, sticky banner and fixed bottom menu still work.

## Data safety

No existing record is modified by viewing the Map or installing this update. Only a user-initiated **Update catch** changes saved coordinates. The existing Android package ID, permanent signing credentials, IndexedDB schema, stored photos and backup format are unchanged. Release display version: **3.7.1**.

If **Show pin** and the stored latitude/longitude agree but the *physical place* is wrong, that saved catch's GPS must be corrected; the app cannot infer a historical fishing location from the current phone position.
