# District Flatwater Fishing 3.11.1

Log a catch → Fishing trip → Trip history & summaries → Delete trip.

Confirm deletion to remove a completed or active trip. Its catches remain in the gallery with their photos, GPS, weather and all other details. Only the trip links are cleared. Cancelling keeps everything intact. Deleting an active trip ends that session.

Catch detachment and trip deletion commit in one transaction, so failures roll back together. Validation covers photo/GPS preservation, unrelated trips, cancellation, active trips and transaction rollback.
