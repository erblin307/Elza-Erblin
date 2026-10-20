# Trip persistence and management

## Authoritative record

The canonical browser record is one `Trip` aggregate. It owns core route/date/traveler/budget/preferences data and optional itinerary, destination resolution, selected stay, transport settings and manual budget ledger. Map markers and Budget linked-activity rows are projections. Provider route geometry and duration results are transient memory data. No page or feature owns another persistent Trip copy.

`TripsProvider` exposes repository-backed reads and mutations. UI state changes only after a successful write. The storage key is `smart-travel-planner.trips.v1`; its current envelope is `{ version: 1, trips: unknown[] }`.

## Compatibility and migration

The repository recognizes three bounded shapes:

- current `{ version: 1, trips }` envelope;
- legacy raw Trip array;
- legacy `{ schemaVersion: 1, trips }` envelope.

Legacy shapes load with a warning and are not rewritten merely by opening the application. The next successful mutation validates the working records and writes the current envelope. Unknown versions, malformed JSON and fully unavailable storage block writes so original bytes are not destroyed. Invalid records are isolated while valid Trip records remain usable; unrelated writes preserve raw optional artifacts according to their existing module rules.

## Revision and tab safety

Every successful mutation sets an `updatedAt` value strictly later than the previous revision, even when two writes occur within one millisecond. Edit and module-save calls include the revision originally observed by the caller. A mismatch means another browser tab changed the Trip, so the repository rejects the stale write with recovery guidance instead of last-write-wins data loss.

The provider listens for same-origin `storage` changes to the Trip key, reloads repository state and announces that trips were refreshed. This is coordination, not collaboration or cloud synchronization. Browser storage quotas and disabled storage surface actionable errors; no in-memory success is reported when persistence failed.

## My Trips projections

Search normalizes case, whitespace and diacritics across title, destination and origin. Filters classify trips as Upcoming, In progress or Past using local ISO calendar dates. Sorting supports recently updated, upcoming departures, recently created and destination name. These operations return new arrays and do not mutate or persist Trip order.

Delete is confirmed, operates on one Trip ID and leaves all other records unchanged. Its message names the embedded itinerary, stay, transport settings and manual expenses that will be removed.

## Duplication policy

Duplication is one domain transformation and one repository write. A copy receives a new Trip ID, collision-safe “(Copy)” title and fresh timestamps.

| Module | Copy behavior |
| --- | --- |
| Core details and preferences | copied |
| Confirmed destination identity | copied |
| Current compatible itinerary/catalog | copied with fresh day and item IDs; stable provider/place identities retained |
| Outdated/incompatible itinerary | omitted |
| Current planned stay | copied with new Trip ownership |
| Outdated stay | omitted |
| Transport defaults/hotel connection options | copied |
| Segment mode choices and route results | cleared because segment identities change and results are transient |
| Manual Estimated expenses | copied with fresh IDs and timestamps |
| Manual Confirmed expenses | omitted as historical spending |
| Linked activity expenses | not copied; derived from the copied itinerary |
| Map state | not copied; derived from copied authoritative data |

The copy and source can subsequently be edited or deleted independently.

## Backup export

My Trips can download a detached JSON snapshot:

```json
{
  "format": "smart-travel-planner-backup",
  "version": 1,
  "exportedAt": "ISO timestamp",
  "trips": []
}
```

Export is user-triggered and local. Prompt 10 does not implement import, merge, validation-on-restore, scheduled backup, encryption, an account, a server database, multi-device synchronization or recovery after browser storage is cleared.

## Long-distance travel artifact

`Trip.longDistanceTravel` is an optional version-1 artifact containing planned journeys owned by that Trip. Repository saves validate ownership, duplicate journey IDs, event structure and the caller's observed revision before replacing the artifact atomically. Malformed travel data is isolated from the readable Trip core and preserved through unrelated writes until an explicit valid travel save replaces it. Trips with no artifact behave as an empty plan.

Manual and provider journeys persist with source, planned status, context snapshot, event local date/time and optional timezone/instant evidence. Provider selections also retain environment, offer/group identity, selected time and price expiry. Deleting a planned journey never deletes manual Budget expenses. Duplication creates fresh journey/cost identities, copies only non-expired records and rebinds context to the new Trip; no ticket state is inferred.
