# District Flatwater Fishing v3.7.2 — Live map pin updates

## Fix

Newly logged or updated GPS-tagged catches now appear on the fishing map without restarting the app and without pressing **Load interactive map** a second time.

- **After database commit:** Saving a catch now fires `df-catches-changed` only *after* the IndexedDB write transaction successfully completes. Editing, deleting and importing catches also emit committed changes.
- **No arbitrary delay:** Removed the previous `save-btn` click listener that waited 600 ms to read catches; large photo writes can take longer.
- **Fresh data on entry:** Opening **Map** reloads the latest saved catches, then updates existing pins. If the map hasn't been created yet and saved GPS catches exist, the Map tab initializes it automatically; **Load interactive map** remains as a fallback if initialization failed.
- **Race protection:** Each refresh has a monotonically increasing sequence ID. Results from older, slower IndexedDB reads cannot overwrite newer catches.
- **No map reinitialization required:** Already loaded Leaflet instances stay active and their saved-coordinate markers refresh in place; view bounds are recalculated to include new locations.
- **Native offline support:** Since the Android APK already bundles Leaflet, it may display saved GPS pins offline even when background map tiles are unavailable.
- **Privacy:** Opening Map initiates map-tile requests to OpenStreetMap when online. Your catch database and photo blobs remain local; the map never requests live phone GPS.
- **Preserved:** Existing catch data, original GPS provenance, catch statistics, fixed navigation, sticky branded banner, splash, Gemini, weather, backup schema, app ID, signed Android key and version-code progression.

## Galaxy test procedure

1. Run the existing Android APK workflow on branch `fix-map-live-save-refresh-v3-7-2`; check `Validate sources`, GPS map test, signed release build and APK signature verification all succeed.
2. Download **DistrictFlatwaterFishing-Signed-Release-APK** and install over the existing signed APK. **Do not uninstall or clear storage.**
3. Keep the app open throughout this test. Log a catch with clearly identified latitude and longitude, then tap **Map**. The map should load automatically and show a pin at the saved coordinates, with the same values in the GPS list.
4. Go back to Log or Gallery, save **another** GPS-tagged catch at a distinct location and return to Map **without closing or reopening the app**. Both pins should appear and the map should fit their bounds.
5. Edit the second catch's saved GPS, save the edit, return to Map, and confirm its pin moves to the corrected coordinates without a second Load interactive map tap.
6. Delete a test catch and return to Map. Its pin should disappear unless other catches share its coordinates.
7. Confirm Map → Gallery → Map does not cause repeated reload prompts or incorrect defaults to the current phone location.
8. Confirm existing photos, Gemini, EXIF/manual/phone GPS, historical weather, Analytics, Diagnostics, banner/splash and bottom toolbar remain fully functional.

**Testing note:** The code and test assertions have been updated, but the next signed APK build and real Galaxy checks must still succeed before this should be considered verified.
