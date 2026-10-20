# Architecture

## Technology stack

The application uses React and strict TypeScript, Vite, React Router, CSS Modules with global semantic tokens, Lucide React icons, Zod validation, React context, browser localStorage behind a typed repository, and Vitest with Testing Library.

## Folder structure

```text
src/
├── app/                 # Application routes and cross-cutting providers
├── components/          # Brand, layout, and focused UI primitives
├── features/trips/      # Trip pages, domain types, services, validation, utilities
├── features/itinerary/  # Pure ranking/scheduling/editing, provider interface, timeline, tests
├── features/map/        # Derived location adapter, tile config, Leaflet UI, map tests
├── features/transport/  # Route validation/planning, Geoapify adapter, shared transport state and UI
├── features/budget/     # Expense schema, derived cost engine, Budget UI and tests
├── styles/              # Global semantic tokens and reset
├── test/                # Shared test setup
└── main.tsx             # Browser entry point
```

## Domain boundaries

`features/trips` owns the Trip model, input validation, display calculations, repository contract, browser implementation, and pages. Cross-cutting theme behavior lives in an app provider. Layout and low-level reusable controls do not depend on trip storage.

Feature modules are sibling directories. They may reference stable Trip/itinerary IDs through deliberate contracts, but do not reach into the localStorage implementation.

## Trip aggregate and persistence

One `Trip` is the authoritative aggregate for core details and the optional itinerary, destination resolution, selected stay, transport settings and manual budget ledger. `TripsProvider` is the only application-level owner of the loaded Trip collection. Pages request typed repository operations and replace provider state only after a successful write; they never maintain a second persistent store.

`LocalStorageTripRepository` writes the version-1 `{ version, trips }` envelope under `smart-travel-planner.trips.v1`. It can read the prior raw-array and `{ schemaVersion: 1, trips }` shapes without rewriting on load; the next successful mutation validates and upgrades them. Unsupported envelopes and malformed JSON are never overwritten. Core validation isolates damaged records, while optional-artifact preservation rules prevent unrelated edits from erasing raw data.

Every successful mutation advances `updatedAt` monotonically. Update and module-save methods accept the revision observed by the caller and reject the write if another tab has already changed that Trip. A same-origin `storage` listener reloads the provider projection and announces the refresh. Search, filter and sort are pure in-memory projections over provider state.

Duplication is a domain operation followed by one repository write. It assigns fresh aggregate and child IDs; copies compatible itinerary/place metadata and the current planned stay; copies transport defaults but clears route-segment choices/results; and copies only estimated manual expenses. Confirmed spending history and all transient provider route geometry are excluded. Export serializes a detached snapshot into the explicit versioned backup format and performs no import. See `TRIP_PERSISTENCE.md`.

## Routing

- `/` — Home and first-use state.
- `/trips` — Saved trip library.
- `/plan` — Initial trip creation.
- `/trips/:tripId` — Trip Workspace with an index Overview route.
- `/trips/:tripId/edit` — Shared planner within the same Trip Workspace.
- `/trips/:tripId/itinerary` — Generation and editable daily schedule for that same trip.
- `/trips/:tripId/map` — Lazy-loaded geographic working surface for that saved itinerary.
- `/trips/:tripId/transport` — Lazy-loaded local routing workspace for that Trip and itinerary.
- `/trips/:tripId/budget` — Lazy-loaded Budget workspace for source-linked and manual expenses.
- Any other path — not-found page.

Routes share one responsive application shell and are defined once in `src/app/routes.tsx`; `src/app/App.tsx` creates the browser router. Tests reuse this route tree through a memory router. React Router's data router enables its built-in navigation blocker for unsaved changes, including browser history. The Map and Transport routes load the existing Leaflet surface and request configured viewport tiles; trip persistence remains local.

## Trip Workspace

`TripWorkspaceLayout` validates the opaque URL ID, loads it once through `TripsProvider.loadTrip` and the existing repository's `get`, and passes the trip through its nested Outlet. Header, sidebar, Overview, and Edit consume this same trip from the existing provider. Local load state holds only request identity/status/error, not another Trip object. Concurrent reads for the same ID are deduplicated; stale completions cannot replace the currently selected route. Editing and Overview share the mounted parent layout, so switching between them does not reload the record.

Desktop has the existing 68px global rail, a 248px contextual sidebar, and flexible workspace content. At 1100px and below contextual navigation collapses above the content; at the existing 720px breakpoint the global mobile header/bottom navigation is reused. Overview, Itinerary, Map, Places, Stay, Transport and Budget are functional contextual links. Future module routes consume `useWorkspaceTrip`; navigation is added only when functional. Unknown feature URLs use the application not-found route.

The header displays the persisted title, route, date range, travelers, derived status, and Edit action. The Overview groups essentials, duration, total budget, and saved preferences; notes render only when present. Loading, invalid/missing IDs, and repository errors have separate accessible states. Retry performs a new read; no state manufactures a Trip.

## Persistence

`TripRepository` defines asynchronous `list`, `get`, `create`, `update`, and `delete` operations, with optional read diagnostics. `LocalStorageTripRepository` is the current adapter. It stores a versioned envelope, validates each record independently, generates stable IDs, and converts parse/read/write failures into explicit storage errors. React consumes the interface through `TripsProvider` and never calls localStorage from page components.

The contract includes `saveItinerary`, `saveStay`, `saveTransportSettings` and `saveBudgetLedger`. `Trip.itinerary` is optional in the same version-1 envelope: catalog metadata is stored once and ordered day items reference candidate IDs. Saves verify the owner, context fingerprint, calendar sequence, costs, references, uniqueness, and schedule constraints. Corrupt optional artifacts are isolated from otherwise healthy trip records, reported, and preserved as raw data until explicit replacement. Preference edits preserve existing plans; changed canonical context flags them stale and disables schedule edits until regeneration. Transport persistence is limited to default/per-segment modes and hotel origin/return choices; route geometry and metrics are never written to localStorage. Budget persistence stores only validated manual expenses; linked itinerary costs remain derived.

## Itinerary boundary

`ActivityCandidateProvider` retrieves unknown inputs with a declared source mode. The service validates mode, calls the pure engine, and supplies a timestamp externally. With a configured key, live mode dynamically loads `GeoapifyCandidateProvider`, requiring the Trip's confirmed geographic destination. Without a key it retains the unavailable adapter. Demo mode dynamically imports a separate fixture module; fixtures are not silently substituted into live requests. Validation, scoring, scheduling, and editing are independent of React and storage. `ItineraryPage` uses the parent workspace trip and saves through `TripsProvider`, not a second store.

The engine produces deterministic round-robin greedy selection with stable-ID ties. Manual edits clone and rebuild schedules before validation. The UI derives totals from saved references, displays source disclosures, and confirms regeneration. See `ITINERARY_ENGINE.md` for exact rules and limitations. Future Places providers supply normalized metadata without replacing this engine; maps can consume candidate coordinates/provider IDs and item day/order without inventing route times.

A damaged record or duplicate ID is omitted from the working list and reported through a read warning. Opening that record reports an error; valid records still load. Original raw records are retained during creation, update, and deletion of healthy trips, including fields outside the planner's ownership. An invalid envelope, unsupported version, or unparsable JSON still prevents writes so the source cannot be overwritten accidentally. Storage access is deferred into guarded operations, allowing browsers with disabled localStorage to render an error instead of crashing at import time.

The existing version-1 storage key is retained. Preferences are optional on stored records so older trips can load without disk migration or invented selections. Newly submitted input is normalized with `createTripSchema`; enum-based preferences use one shared model. Destination strings remain user-authored labels. Optional `destinationResolution` is saved by the explicit `saveDestination` repository contract after selection; it does not replace that label. Invalid resolution metadata is isolated and preserved. A meaningful destination edit clears the resolution. Its provider ID enters the itinerary context fingerprint; a changed resolution preserves but marks an older plan stale.

`TripPlannerForm` owns one editable state object, field errors, review state, and submission state. `TripDetails` presents the same normalized data in review and overview. Repository updates preserve ID and creation time, reject missing IDs, and leave timestamps and storage untouched on semantically unchanged input. Notes are plain user text and do not trigger downstream behavior.

This is device-local browser persistence, not cloud synchronization. A later backend adapter can implement the same contract; authentication, conflict resolution, migration, and remote error semantics must be designed at that time.

## Map boundary

`features/map/domain/mapData.ts` resolves itinerary catalog references, validates the existing latitude/longitude structure and derives rows, marker coverage and antimeridian-aware bounds. It has no storage, discovery or generator responsibilities. Missing candidates or coordinates cannot crash the adapter or become substitute positions. `TripMapPage` consumes the same parent workspace Trip and memoizes derived data; marker records are never persisted.

The page owns one `{dayId, itemId}` selection. Markers and rows derive highlights from it; filter changes, item removal and trip switching reset invalid selection. View mode and fit/focus commands are UI-only. URL deep links connect the Map and Itinerary routes without another store. The Leaflet component receives normalized markers and callbacks, not a repository. React-Leaflet owns mount/cleanup, a ResizeObserver refreshes visible container size, and explicit focus refreshes size before centering after hidden mobile panels. Bounds are refit for location/filter changes and explicit fit, not theme or unrelated selection changes.

`tileConfig.ts` centralizes public raster source/attribution configuration. Development uses OSM standard HTTPS tiles with visible attribution; production requires explicit authorized configuration. No cache bypass, scraping, prefetch, tile inversion or geolocation is used. `RouteOverlays` receives only already validated route geometry from the transport context, converts GeoJSON `[longitude, latitude]` to Leaflet `[latitude, longitude]`, and renders restrained selectable polylines without creating another map. Loading, tile failures/retry, initialization failure, missing configuration and zero coordinates have distinct handling. Static source-checked geographic fixtures are a separate explicit demo adapter; prior generic fixtures and saved itineraries are unchanged.

## Date strategy

Travel dates are ISO `YYYY-MM-DD` calendar strings. Validation checks real calendar dates and compares strings without converting them to instants. Formatting constructs local calendar dates from numeric parts, avoiding UTC timezone shifts.

## Places and media boundary

The lazy Places route consumes the same workspace Trip. `GeoapifyPlacesProvider` handles documented endpoints; normalizers validate unknown response records independently. `Place` extends the existing candidate schema, and optional candidate `place` metadata holds provider categories, address, references, attribution and one normalized image. Shared coordinates and stable provider identity pass unchanged into the existing catalog, mutation service, repository and map adapter. `placesService` reuses `rankCandidates`; the UI does not score raw responses. Discovery results are transient, not a second Trip/activity store.

`RequestClient` controls timeout, cancellation, deduplication, bounded caching and quotas. Wikimedia resolution is serial and selected-detail-only. Exact Wikidata references plus nearby Earth coordinates connect P18 files to Commons; author/license/source metadata is validated before `TravelImage` renders. The same component renders saved activity photos. See `PLACES_AND_MEDIA_INTEGRATION.md` for actual policy and limitations.

## Accommodation boundary

`AccommodationDiscovery` consumes raw validated envelopes from the existing Geoapify singleton, not a second HTTP client. Shared `geoEntity` normalization retains identity, coordinates and source metadata separately from activity scheduling. Accommodation has category-derived property types; a pure scorer uses saved type preference and straight-line distance only. `Trip.selectedStay` stores one validated property snapshot and the selection's date/destination/traveler context. The existing repository owns all storage writes and preserves malformed optional artifacts until explicit replacement/removal. Overview and the existing map derive their stay content directly from this Trip. A distinct property marker shares the same map and focus state as activities. Commercial inventory has an extension contract only; the current cost projection is unknown. See `ACCOMMODATION_SYSTEM.md`.

## Transportation boundary

`features/transport/domain/routing.ts` owns central coordinate-order conversion, provider-response validation, normalized route models and cache identity. `planner.ts` derives segment endpoints only from the current saved itinerary order and the optional current selected stay; it never reorders or bridges over missing coordinates. `GeoapifyRoutingProvider` reuses the existing Geoapify client to call `/v1/routing` and returns normalized provider data outside React.

`TransportProvider` is mounted once inside the Trip Workspace so Transport, Map and Itinerary share route results and one selected segment while navigating. It issues only explicit day/segment/compare calculations, cancels obsolete work, limits calculations to one request at a time and keeps a bounded five-minute memory cache. Segment identity contains trip, day and endpoint identity; the route key also contains ordered coordinates, mode, routing options and provider data version. Itinerary, stay or mode changes therefore make incompatible results inaccessible without relabeling them. Small user choices persist through the repository; results expire on reload. See `TRANSPORTATION_AND_ROUTING.md`.

## Budget boundary

`features/budget/domain/model.ts` owns the versioned manual expense ledger, categories, certainty and validation. `engine.ts` is a pure projection over the current Trip: it reads the ledger, derives itinerary activity expenses from stable item/candidate references, and asks the existing accommodation cost boundary only for known-versus-unknown coverage. It never writes derived rows back to storage and never guesses transport, accommodation or foreign-exchange prices.

All arithmetic is normalized to integer cents before aggregation. Only amounts in the Trip's current currency contribute to the total. The engine returns confirmed/estimated splits, category and inclusive-calendar daily totals, remaining/over-budget state, coverage and deterministic insights. `BudgetPage` owns editing state and saves the complete validated ledger through `TripsProvider`; it does not call localStorage. Overview reads the same projection for its compact budget summary. See `BUDGET_MANAGEMENT.md`.

## Long-distance Travel boundary

`features/long-distance-transport` is separate from destination-level routing. Its domain owns versioned planned journeys, timezone-preserving events, offer/cost identity, staleness and schedule constraints. React pages call `FlightSearchProvider`; they never call a commercial API or read secrets. The browser adapter only calls a configured secure endpoint and validates its normalized response. A pure Duffel normalizer documents/tests the server mapping, while missing configuration resolves to an explicit unavailable adapter.

The Trip repository remains the only durable owner. It validates the optional travel artifact independently and saves it with optimistic revision checks. Overview, Itinerary and Budget derive from that same artifact. Local routing remains activity/stay connection geometry and is not overloaded with intercity schedules.

## Prompt 12 assistant extension

The Trip workspace adds a lazy `/trips/:tripId/assistant` route. `TripsProvider`
owns one memory-only `AssistantOrchestrator` for its repository lifetime.
Strict actions dispatch existing itinerary editing, Places, routing and budget
services. Proposals bind to a Trip revision and require explicit confirmation.
Saved changes publish through the existing shared Trip state; no duplicate
domain store or schema migration is added. See `AI_TRAVEL_ASSISTANT.md`.
