# District Flatwater Fishing 3.5.0 — Branded launch and GPS fallback

## New launch experience

- Native Android splash theme uses the approved hunter-green `#00380e` and District Flatwater Fishing emblem.
- Matching, brief in-app launch overlay shows the same emblem and wordmark. It dismisses automatically when the catch log initializes, or after a short fallback if app data is slow/unavailable.
- The splash does **not** read, delete, or migrate catches and does not prevent Diagnostics from opening.

## Capture GPS when photo EXIF lacks coordinates

After choosing a photo, the catch form has three deliberate options:

1. **Use photo date & GPS** — When embedded EXIF exists, keep the original photo coordinates (current behavior).
2. **Use entered GPS** — Enter signed decimal latitude and longitude (N/E positive, S/W negative), with strict bounds latitude ±90, longitude ±180. Press the button to commit these coordinates; input fields alone do not overwrite a saved record.
3. **Use phone GPS only** — Ask Android's existing Capacitor geolocation bridge for the phone's **current** position, without loading current weather. This is not evidence of where an old picture was taken.
4. **Capture GPS & weather** — The existing separate button still fetches the phone's current location, then today's weather.

You can save a catch without coordinates if neither source is available. All chosen coordinates are shown, and the saved catch can identify whether coordinates were selected from EXIF, manually entered, or captured from the phone. Manual or phone GPS cancels stale historical-weather previews, clears a previous draft weather value, and permits a new explicit historical lookup for old catches.

## Signed APK test on Galaxy

1. From GitHub Actions run `Build District Flatwater Fishing APK` against feature branch `feature-splash-manual-phone-gps-v3-5`.
2. Confirm `Validate sources`, `Install District Flatwater native launch screen`, `Build test APK`, `Optionally sign release APK` and `Verify signed release APK` succeed.
3. Install **DistrictFlatwaterFishing-Signed-Release-APK** as an update over the installed signed release. **Do not uninstall or clear storage.**
4. Launch the app: hunter-green branded native splash appears, then the catch-log screen; no stuck overlay.
5. Select a photograph **without GPS EXIF**, enter latitude `38.8895`, longitude `-77.0353`, press **Use entered GPS**, save a test catch. Reopen it to confirm coordinates and source persist.
6. Try invalid numbers (`91, 0`; `0, -181`; missing longitude). Must reject without overwriting existing coordinates.
7. Tap **Use phone GPS only**, allow permission if prompted, confirm coordinates display. This must not automatically request today's weather.
8. Verify **Capture GPS & weather** still works, and an older photo can use manually entered GPS plus historical weather.
9. Reopen existing catches and verify no loss of photos, location, date, Gemini settings, Analytics, Maps, or Diagnostics.

## Compatibility

No changes to `com.districtflatwater.fishing`, database `district-flatwater-catches-v1`, object store `catches`, signing secrets, JSON backup format, or app's web origin. The new release continues using automatic monotonic Android version codes in GitHub Actions.

**Note:** The native Android splash is shown by the OS while the WebView starts. Splash appearance can differ slightly by Android version; v3.5 also includes a matching short in-app overlay.
