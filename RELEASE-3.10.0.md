# District Flatwater Fishing 3.10.0

Presentation and navigation upgrade built on the v3.9.0 safeguards. This branch targets the v3.9.0 review branch until that release is accepted.

- Five main destinations: Home, Log, Gallery, Map and More. Analytics is under More, alongside Settings & backup and separate Diagnostics.
- Compact shared brand header; Home holds the full emblem, catch counters, recent catch cards, logging and backup shortcuts.
- Photo and species remain visible in Log. Optional location/weather and additional catch details expand on demand. Editing opens both sections; applying a measurement opens the length field. Save remains accessible above the bottom navigation.
- Gallery searches species, spot, lure and notes alongside existing species/sort controls. Cards emphasize photos and catch information; View opens a detail dialog containing Edit and Delete actions.
- Map filters collapse independently from the saved-location list. Existing pin summaries and saved-GPS behavior remain.
- Measurement adds a short three-step guide, a larger photo viewport and sticky Fit/zoom controls.
- Keyboard focus follows tab headings; reduced motion and visible focus styles are supported.

No database/schema, app identity, signing, photo metadata, backup format, or GPS acquisition changes. Existing v3.9.0 atomic restore and conflict preservation remain intact.

Validation: ten Node regression suites and packaged web build pass locally. CI additionally exercises mobile Home/Log navigation, header size, optional sections, saved measurements, spot preservation, recent catches, Analytics/More selection, gallery search, portrait/landscape Fit and photo units. CI captures Home, Log, saved Home and Gallery previews. Signed APK build and signature verification must succeed before device testing.

Device acceptance: export a backup, install the signed update over the existing app, verify catch count and old photos/GPS, edit a saved catch, check measurement Fit and search/filter navigation. Do not uninstall or clear storage. Keep review separate from live release until device acceptance.
