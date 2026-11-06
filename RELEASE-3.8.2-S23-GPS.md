# Galaxy S23 original-photo GPS compatibility (3.8.2)

This update keeps all existing IndexedDB catches and Android package/signature identifiers unchanged. It only changes how *newly selected* images are read.

## Changes
- Android photo selection requests location metadata consent using the platform-defined Photo Picker extra. Whether GPS is returned remains controlled by Android and the user.
- The custom Capacitor plugin reads a user-selected original image before the application's JPEG compression, extracts EXIF via AndroidX ExifInterface, and only copies it to temporary app-private cache.
- Camera captures use Capacitor 8.1's `takePhoto` with `includeMetadata`; older native bridges have a gallery fallback.
- An explicit **Browse original photo file** option uses Android's document picker when Gallery returns no GPS. It is available even if no metadata is present.
- JavaScript EXIF reader accepts Capacitor JSON EXIF, standard GPS rational fields, and Samsung-style DMS arrays. Latitude/longitude must be a complete valid pair from a single source.
- A missing/withheld location stays missing. The app does **not** substitute the S23's current GPS.

## Galaxy S23 verification
1. Install the signed release **over** the existing app. Do not uninstall or clear data.
2. In Samsung Camera, enable Location tags. Capture a new JPEG.
3. In Samsung Gallery, inspect Details and confirm a map/location is attached.
4. In Fishing > Log Catch > Choose photo, choose the JPEG. Allow location sharing if prompted.
5. Confirm **Photo GPS** appears, then tap **Use photo date & GPS**; confirm coordinates are populated and source reads original photo EXIF.
6. If GPS is missing, tap **Browse original photo file**, navigate to DCIM/Camera and choose the JPEG. Confirm GPS again; manual GPS remains a supported fallback.
7. Save a disposable test catch and verify its stored GPS in Gallery and on Map; confirm it survives restarting the app.
8. Check an older no-GPS photo. The app should report GPS unavailable and never use live phone GPS unless requested.
9. Confirm existing catch history, branding, photo measurement and zoom remain unchanged.

## Limitations
Android Photo Picker location sharing may not be supported on every system version. Android or a cloud provider may still redact or omit location tags. File import does not restore already-stripped EXIF.
