# District Flatwater Fishing 3.11.0

Start and end a named fishing trip from Log a catch. New catches join the active trip; previous catches remain independent. Trip history shows duration, catch count, species and links to individual catches. Active trips survive closing and reopening the app.

Save & log another returns to a clean photo/species form. The last saved lure and technique are remembered and can be changed or cleared. Optional details can still be added later by editing a catch.

Use last trip location & conditions explicitly copies the most recently saved location and weather in the active trip. Check them when moving; the source is labeled as shared trip location. GPS and conditions never silently carry into a new catch.

Storage adds a trips object store to the existing database without deleting or rewriting catches or photos. Existing backup files remain accepted. New backups include trips and catch links. Restore keeps matching IDs and adds trips and catches in one transaction; restored active trips are marked complete to avoid silently attaching future catches to an old outing.

Validation: legacy database migration/photo preservation, reopening trips, backup validation/conflict preservation/atomic rollback, navigation, map refresh and photo measurement unit checks. Browser flow test is included in Android CI. Local Chromium could not start because this environment blocks its process singleton socket.

Phone check: export a backup, install the signed update over the existing app, confirm old catches, start a trip, save two catches with Save & log another, reopen the app, then end the trip and check its summary.
