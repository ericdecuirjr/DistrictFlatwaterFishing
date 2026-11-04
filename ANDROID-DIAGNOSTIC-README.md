# Android diagnostic build — safe test instructions

The user reported failure of photo selection, catch save, restart persistence, GPS and weather after installing a repaired debug APK.

This branch adds a diagnostic panel **only to the Android APK**. The public website is unchanged. The diagnostic does not access the existing fishing catches IndexedDB database, and instead uses a separate disposable temporary database for a photo-blob write/read test. It uses fixed dummy coordinates (0,0) for an online weather service connectivity check, not your personal location.

The native APK no longer registers the website service worker and unregisters older APK-local service worker registrations. **The app's IndexedDB catches and backup format are not deleted, cleared or migrated.**

## Before installing

1. Keep the current Chrome/PWA app and its records; export and retain a JSON backup from the PWA.
2. If the installed APK has catches of its own, export those too before installing or uninstalling anything.
3. Once this diagnostic change is merged and a new Android APK workflow succeeds, download the new debug APK and install as an update if Android permits.
4. If Android refuses to update because the signature differs, **do not uninstall yet** if the debug APK has any valuable data. Let us review a backup/migration option first.

## Testing

Open the updated APK. At the top, tap **Run safe diagnostic checks**, then **Copy report**. Share the text results, which report:

- Capacitor and the native Camera/GPS bridge
- Camera/Geolocation plugin availability
- Temporary IndexedDB test data including a photo Blob
- Open-Meteo connectivity using *fixed* dummy coordinates
- Browser JavaScript errors and displayed app version

The report does **not** include GPS coordinates, API keys, fishing pictures or saved catches.

Note: The check does not grant/request location permissions or take a photo. It cannot prove the device's camera or GPS is working. After reviewing the report, we can test only the failing subsystem with clearer evidence.

## Caution

Don't clear app storage or uninstall the PWA; keep the original backup until the corrected Android app has passed saving and persistence tests. Avoid setting permanent release signing until those tests succeed.
