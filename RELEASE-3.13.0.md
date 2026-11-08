# District Flatwater Fishing 3.13.0

Log → Import multiple catches opens the gallery for up to 10 photos. Each photo becomes a separate catch after review. Save catch & review next commits the current catch before advancing. Species is required; date/GPS metadata remains explicit. Lure and technique carry forward, while species, location, weather, notes and measurements reset for each photo. New catches join the active trip.

Skip a photo or stop the remaining queue with confirmation. Saved catches are kept. Unreadable photos are counted and skipped so the rest can continue. The queue stays in memory: keep the app open until finished; unsaved photos must be selected again after closing. Each queue entry has a stable ID and Save is locked while processing to avoid duplicate saves.

Android uses the system multi-photo picker and reads one selected image at a time. Available metadata varies with Android/gallery permissions. Existing single-photo and original-file import remain available outside a batch. No schema migration or existing catch rewrite is needed.

Validation covers batch review, species requirement, double-save protection, skip, unreadable images, GPS isolation, cancellation, stopping and saved catch persistence, plus existing storage, backup, map and measurement checks.

Install the signed update over the existing app without uninstalling. Export a backup before updating.
