# District Flatwater Fishing v3.6.1 — Map pin and location repair

This patch addresses map pin rendering after the fixed bottom navigation introduced in v3.6.0.

## Changes

- **Latest saved catches every time:** Entering Map now refreshes IndexedDB catch locations before displaying pins. A Refresh saved locations button is provided to reload the list manually.
- **Correct geographic view:** The map fits the bounds of the saved GPS locations rather than relying on a hard-coded starting view. A single location centers at zoom 13; multiple locations fit within the viewport.
- **Overlapping catches:** Identical or near-identical coordinates (to six decimal places) share a clearly numbered pin; tapping it lists the catches.
- **Visible marker icons:** High-contrast pins use built-in HTML/CSS instead of depending on remote Leaflet icon PNG files.
- **Local map software:** The signed APK now bundles Leaflet JavaScript and CSS; an external CDN is used only for the GitHub Pages PWA. The background map tiles still require internet. Even if tiles cannot load, the app reports the issue and preserves GPS pin placement and the list of saved coordinates.
- **Hidden screen resizing:** Navigating from the fixed bottom toolbar to Map invalidates the map viewport after the screen becomes visible, preventing shifted or clipped marker placement.
- **GPS normalization:** Valid decimal coordinate strings and numeric values are supported, including zero. Non-finite, missing and out-of-range coordinates are excluded. No catch data is rewritten.

## Galaxy verification

1. Run the GitHub Actions Android workflow against branch `fix-map-rendering-pins-v3-6-1`; the `test-map.mjs` checks and signed APK verification should pass.
2. Download only `DistrictFlatwaterFishing-Signed-Release-APK` and install **over** the existing signed APK without uninstalling.
3. Open **Map**, tap **Load interactive map** if prompted. Confirm the map zooms to your recorded catch locations and pins appear at the coordinates displayed in the list below.
4. Return to Gallery, edit/save an existing geotagged catch (or save a new test catch), then open Map. Confirm the new data appears. Try **Refresh saved locations**.
5. Test two catches with the same GPS coordinates; confirm one numbered marker opens a popup listing both catches.
6. Test with mobile data/Wi-Fi off: the map background may not draw, but the saved GPS list stays available; turn data on and try again.
7. Verify Analytics, Log, Gemini, photo metadata, GPS entry and all saved photos remain intact. The catch count should not change solely due to this update.

## Compatibility

No changes to the Android package ID, signing credentials, database name/schema, saved catch contents, backup format, Gemini configuration, weather, app icon/splash, or fixed toolbar. App display version is 3.6.1.
