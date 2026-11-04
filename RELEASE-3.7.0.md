# District Flatwater Fishing v3.7.0 — Persistent banner and two-second splash

## Requested interface changes

- The approved hunter-green District Flatwater Fishing banner is approximately **10% larger**, including its logo, heading, and desktop spacing.
- The banner and top header now sit in one **sticky** shell outside the tab-specific content. It remains visible when navigating Log, Gallery, Analytics, Map, More, Settings, and Diagnostics and while scrolling. The fixed five-button bottom toolbar is retained.
- The banner's statistics (total catches, species, latest catch) keep their existing element IDs and remain live; no catch-data logic is changed.
- On Galaxy-width and short screens, a compact horizontal version preserves room for the form, map, and bottom navigation.
- The matching branded **in-app splash** remains visible for at least **2,000 ms** on successful startup, then fades away. A maximum 5-second fail-safe prevents an unsuccessful database initialization from trapping the user behind the splash.
- **Android OS splash timing** is controlled partly by the operating system; the branded native splash may appear briefly before the two-second in-app screen. The OS-to-app transition duration is device-dependent.

## Preserved

No database migration or changes to permanent APK signing, Android package ID, saved catches, photos, GPS, Gemini, historical weather, Map v3.6.1 fixes, Diagnostics, or the fixed lower toolbar.

## Galaxy verification

1. Open GitHub Actions → Build District Flatwater Fishing APK, choose branch `feature-sticky-brand-banner-two-second-splash-v3-7` and run.
2. Confirm **Validate sources**, the new **test-sticky-banner-splash.mjs**, Build web content, signed APK packaging and signature verification succeed.
3. Download **DistrictFlatwaterFishing-Signed-Release-APK** and install **over the currently installed signed APK**. Never uninstall or clear storage.
4. Launch the app and check the hunter-green-and-white splash is visible for approximately two seconds once the WebView starts. The Android system splash may add extra launch time.
5. Open each bottom destination, then Settings and Diagnostics inside More. Confirm the enlarged banner and catch counts remain visible when changing tabs and scrolling.
6. Open Map, use **Load interactive map**, inspect catch locations and pins, then switch tabs and return. Pins and tiles must still render and align correctly.
7. Scroll the Log form to Save Catch. Confirm the sticky banner and fixed bottom toolbar do not obscure essential form fields, and the catch gallery/analytics and all saved data remain intact.
8. Confirm all existing catches, GPS metadata, and the Gemini service are unchanged.

Merge the pull request only after successfully testing the signed release on your Galaxy.
