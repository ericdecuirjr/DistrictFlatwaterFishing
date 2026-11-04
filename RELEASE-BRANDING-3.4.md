# District Flatwater Fishing — Brand refresh (v3.4 proposed)

## What changed

- **Banner:** The dashboard now displays the approved white bass/fleur-de-lis circular emblem on a rich hunter-green banner. Existing catch statistics, heading, and navigation remain intact.
- **Header:** The same emblem replaces the old generic fish mark beside the app name.
- **Browser/PWA icon:** The branded SVG is the preferred icon and favicon. The Android packaging build generates fresh 192px and 512px PNG copies from the same SVG. Some phone launchers may cache an old PWA icon; re-add the shortcut only if necessary, keeping the PWA's catch data intact.
- **Android launcher:** The signed Android build generates regular and adaptive icons from the approved artwork across densities. Native launcher resources use a hunter-green background and white emblem.
- **No database, Gemini, historical weather, or signing changes.**

## Galaxy testing

1. Run the APK workflow from the PR branch `branding-hunter-green-banner-and-icon`.
2. Check the **Validate sources**, **Build web content**, **Install District Flatwater launcher artwork**, **Build test APK**, **Optionally sign release APK**, **Verify signed release APK** steps.
3. Download the **Signed-Release-APK** artifact, never the Debug APK.
4. Install the signed APK **over** the currently installed fishing release; never uninstall or clear storage.
5. Check the launcher thumbnail and in-app header/dashboard banner on a Galaxy phone, including the smallest screen width. Make sure the fish and wording are legible.
6. Check existing catches and photos persist; test Gemini, EXIF, historic weather, Analytics, Map and Diagnostics.
7. Once satisfied, merge PR and build the signed APK again from `main`.

## Notes

- The branding source is `branding-logo.svg`; it was traced from the approved white-on-hunter-green fishing emblem to keep it small and scalable.
- PNG Android/PWA assets are generated during the signed APK build. The GitHub Pages PWA prefers the same SVG and will refresh from its service-worker cache when deployed.
- The JavaScript packaging script is responsible for creating native launcher assets. If the Android build fails in icon generation, do not modify the existing app installation; inspect the workflow run.
