# District Flatwater Fishing v3.6.0 — Fixed navigation

## What changed

The previous wrapping/scrolling tab bar has been replaced with a permanently visible, five-destination bottom toolbar:

- **Log:** Log or edit a catch, photo EXIF, GPS, weather, Gemini.
- **Gallery:** Browse, edit, view, or remove existing catches.
- **Analytics:** All existing catch statistics.
- **Map:** Your geotagged catches and optional interactive map.
- **More:** A clean hub that opens **Settings & backup** or **Diagnostics**.

Each destination displays only its own screen, keeps its active-state indicator, and preserves the user's saved data. Settings and Diagnostics show **Back to More** buttons. The large branded dashboard is shown only while logging a catch to reduce clutter on the other screens.

The bottom bar stays fixed while scrolling, uses five icon-and-label buttons, supports focus outlines and Android gesture/navigation safe-area insets, and adds bottom-page padding so Save Catch controls aren't hidden. Phase-3 Analytics and Map subscribe to the same navigation event used by the rest of the app, avoiding competing navigation handlers.

## Compatibility

No changes to package ID, permanent Android signing certificate, IndexedDB database name or schema, existing catch records, photos, backups, Gemini URL, EXIF/phone/manual GPS, historical/current weather, map data, or launch branding. The PWA offline shell was bumped to pick up the layout change.

## Test checklist on Galaxy

1. Run Android build workflow on branch `feature-fixed-bottom-navigation-v3-6`. Confirm the new navigation test, source validation, signed APK and signature verification succeed.
2. Install only the **Signed-Release-APK** over your installed signed release. **Do not uninstall or clear app data.**
3. Scroll a long catch form to Save Catch: confirm the five-item bottom bar stays visible and does not overlap any controls.
4. Test each icon: **Log**, **Gallery**, **Analytics**, **Map**, **More**. Confirm exactly one screen is visible and active highlight follows selection.
5. Within **More**, open Settings and Diagnostics; return via **← More** and check the More icon remains active.
6. Open Gallery, edit a saved catch, confirm the toolbar changes to Log and existing edits are intact.
7. Verify saved catches and photographs persist. Also check photo EXIF, Gemini, manual and phone GPS, weather lookup, Analytics, map, and branded splash remain operational.
8. Verify portrait mode, small-screen width, gesture navigation, and offline reopening. If the bottom bar is obstructed on your phone, report the screenshot before merging.
9. Once the signed APK passes testing, merge PR into `main`, then run a fresh signed build on `main` for the final release.

The source changes are ready; physical-device and signed APK verification still need to be performed.
