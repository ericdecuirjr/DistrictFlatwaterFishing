# Android catch saving, GPS & weather repair

This change is specific to the Android APK. The GitHub Pages PWA continues using its existing browser capabilities and remains on the original IndexedDB database `district-flatwater-catches-v1`.

## What changed

- Android build declares `ACCESS_COARSE_LOCATION` and `ACCESS_FINE_LOCATION` in the generated manifest.
- Explicit runtime location permission request through Capacitor; a permission denial now shows an actionable message.
- Native camera/gallery picker returns actual photo file bytes to the existing catch processor.
- JPEG processing falls back to an image element when Android WebView does not support `createImageBitmap` for a photo.
- Catch ID generation has a fallback; capture/save failures remain visible longer and are echoed under Settings → Android troubleshooting.
- Existing `catches` schema and backup format are unchanged.

## Test safely on Galaxy

1. **Keep the working GitHub Pages app and its backup.** Export a fresh JSON backup from your web app before modifying APKs.
2. Merge this pull request, then start the Android APK build workflow on `main`.
3. Download the successful debug APK artifact, unzip and attempt to install it.
4. **Debug signing certificates can differ between GitHub-hosted builds.** If Android reports that the package cannot be updated due to a signature mismatch, export anything saved in the old APK (if possible), uninstall only the **debug fishing APK**, then install the newly built APK. Do **not** uninstall the fishing PWA or clear Chrome data.
5. In Android Settings → Apps → District Flatwater Fishing → Permissions, allow location while using the app and choose Precise location for best results. Enable the phone's Location switch.
6. Choose photo or take a photo; confirm preview, enter species, and tap Save. Verify that Gallery displays the catch, then close and reopen the app to confirm persistence.
7. Capture GPS, then confirm weather loads while online. Try Open-Meteo again with network access if weather is unavailable.
8. If an operation fails, read **Settings → Android troubleshooting** and share the message **without private coordinates, keys or catch photos**.
9. Only import the web JSON backup into the APK after confirming photo and storage operations. Verify catch count and photos.

## Signing follows testing

The release keystore is separate from the debug build. Configure it only after the repair is verified; release and debug variants do not necessarily install over each other. Keep the same release signing key for all future updates.

## Scope and limitations

Native functionality is not yet verified on a real device by this pull request. Weather still requires network access and working GPS; the mobile app's AI endpoint may need a Cloudflare allowed-origin adjustment for `https://localhost`. Phase 3 analytics and maps are not rewritten.
