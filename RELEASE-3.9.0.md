# District Flatwater Fishing 3.9.0

Controlled upgrade from main v3.8.2. No database name, object store, Capacitor app ID, signing key, GPS acquisition, or photo metadata flow changes.

## Data protection

- Restore validates all records and decodes photos before any writes, rejects duplicate IDs, previews the count, and asks before import.
- Adds new IDs in a single transaction; existing IDs always win, including concurrent saves. Any transaction failure rolls back the restore.
- Edits preserve unrecognized saved fields.
- Settings shows catch count, last backup download request, available storage estimates and persistence status; persistent storage can be requested.
- Export still includes photos, coordinates, measurement data and all catch fields. Backups are private files. A download request is not proof of a file saved elsewhere.

## Photo refinement

- Switching inches/centimeters converts the reference dimension so the physical estimate remains unchanged.
- Custom dimension edits reset the preset label. Existing whole-photo Fit, zoom buttons, pan and normalized endpoints are retained.
- Measurement remains approximate; reference and fish should be in the same plane. No weight estimate is inferred.

## Fishing locations

- Optional spot name and favorite flag on each catch, included in backups.
- Map filters combine species, lure, spot name and favorites; lists show names and stars.
- Pins still use saved coordinates only, including zero coordinates. No automatic phone fallback or location upload is added. Map tiles retain existing OpenStreetMap behavior.

## Verification and rollout

Run existing Node regression suites plus `node test-controlled-upgrade.mjs` after installing package-android.json dependencies. The new suite covers invalid late records, duplicate IDs, cancellation, existing conflicts, repeated import and an injected transaction abort; map filters are covered too.

Packaged web build succeeds locally. Mobile browser regression is configured in CI, including reference unit conversion and portrait/landscape Fit checks; local Chromium cannot start under this environment's socket restrictions. Android signing and APK build must pass on the branch before rollout.

Before installing: export and keep a backup file. Install the signed update over the existing app; do not uninstall or clear app storage. Verify catch count, an older photo/GPS catch, a measured catch and restore using a separate test installation before merging/releasing. No automatic cloud backup or overwrite restore is included.
