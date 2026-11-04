# District Flatwater Fishing v3.7.3 — Reliable live GPS map pins

## Confirmed root cause

The map screen created the saved fishing locations list with the CSS class `df-map-list` but never assigned its DOM ID `df-map-list`. All calls to `renderLocations()` attempted to find that ID and returned early, **before reaching `updateMarkers()`**. Restarting the app and manually pressing **Load interactive map** happened to call `updateMarkers()` directly and therefore appeared to repair the map.

## Fix

- Assign the required `id="df-map-list"` to the saved fishing locations container. Ordinary Map-tab refreshes can now complete and redraw Leaflet markers.
- A successfully committed save now sends its **saved** latitude/longitude and GPS source to the map immediately (without photo bytes or a live phone-location request). The in-memory map is updated at once and then reconciled with IndexedDB in the background.
- Clear an old species filter when a new catch is saved/edited so it cannot invisibly exclude the new pin.
- Prevent older in-flight IndexedDB reads from replacing newly committed catch data.
- Add a live status line showing how many saved GPS catches and distinct pins the map is displaying. Continue retaining the existing on-demand **Refresh saved locations** button as a fallback.
- Preserve existing marker grouping, **Show pin**, **Edit GPS**, source labels, native offline Leaflet library, Map tab, sticky branded banner, two-second splash, and five-button bottom navigation.

## Verified tests

- Added `test-live-map-integration.mjs`, which simulates the actual Map screen with a document/IndexedDB/Leaflet environment and checks that an initial pin appears, saving a new catch adds a second pin **in the same session**, editing moves the pin, a new species shows despite a stale filter, and deletion removes a pin.
- Added source checks in `test-map.mjs` specifically for the previously missing DOM ID. Verified both test suites against the updated code. GitHub Actions now runs the integration test in **Validate sources**.
- No current catch database or user's private photos are used by either test.

## Galaxy signed-update verification

1. Run `Build District Flatwater Fishing APK` on branch `fix-live-map-authoritative-pins-v3-7-3`; check all tests, build, signed release and APK signature verification complete.
2. Install the **Signed-Release-APK** directly **over** the current signed fishing app. Do not uninstall or clear storage.
3. Open **Map** and load once if required. Check the GPS list and existing pins.
4. **Without restarting**, save a catch with new GPS coordinates; return to Map. The saved list and pin should both update immediately, without pressing Load interactive map.
5. Save another catch with different coordinates and check that the map now shows both. Edit one GPS value and check its pin moves; delete a test catch and check the pin disappears.
6. Test with a previous species filter active: saving a new species should make its GPS pin visible.
7. Confirm existing photos, species, Gemini identification, historical weather, manually entered/photo GPS, and backup/export remain untouched.

## Data safety

No changes to the Android application ID, permanent signing credentials, IndexedDB database name/schema, historical catch records or photos, backup format, app branding, splash, or navigation. The map remains read-only with respect to stored catch records. Display version **3.7.3**; PWA shell version **v13**.
