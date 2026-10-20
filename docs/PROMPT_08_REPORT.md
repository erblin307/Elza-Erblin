# Prompt 08 implementation report

Local implementation is complete. Provider-contract, normalization, planner, persistence, workspace, itinerary and Leaflet integration are covered by automated tests and local browser QA. Credentialed Geoapify routing remains unverified because no API key was available. The hosted site was not changed.

## A. Existing code reused

- Prompt 01–03: application shell, Route Frame branding, semantic themes, nested Trip Workspace, `TripsProvider`, versioned repository, responsive navigation and shared controls.
- Prompt 04: saved itinerary catalog/day/item order, schedule timestamps/durations, mutation service, stale-context protection and editable timeline.
- Prompt 05: the existing `InteractiveTripMap`, tile configuration, activity markers, map lifecycle/error handling and selection/focus conventions.
- Prompt 06: the existing Geoapify singleton, request client, key configuration, timeout/deduplication/cache/rate-limit behavior and normalized coordinates.
- Prompt 07: `Trip.selectedStay`, accommodation validation/current-context rules and existing Stay markers.

No second Trip store, map, routing HTTP client or itinerary engine was introduced.

## B. Routing provider

`GeoapifyRoutingProvider` calls `GET https://api.geoapify.com/v1/routing` through the existing Geoapify client. It sends ordered `latitude,longitude` waypoints, `units=metric`, `type=balanced`, `traffic=free_flow`, `optimize_stops=false` and one of `walk`, `drive` or `bicycle`. The official contract used is [Geoapify Routing API](https://apidocs.geoapify.com/docs/routing/).

## C. Real route calculations

Production values come only from validated Geoapify response fields: route/leg distance in meters, route/leg time in seconds and provider GeoJSON. The normalizer rejects inconsistent metrics, endpoints, leg counts, geometry or mode association. The application does not use haversine distance, straight polylines or speed multipliers as route substitutes.

## D. Transportation modes

Walking, driving and cycling are functional. Each comparison value is a separate provider request or current identical cached request. `transit` and `approximated_transit` are intentionally unavailable because useful destination coverage, actual line/stop detail, timetable meaning and live-departure support were not verified.

## E. Accommodation integration

A current valid selected stay can be enabled as the day's first origin and independently as the final return destination. The stay is a geographic anchor only, never an attraction. Missing, stale or removed accommodation yields no invented hotel segment. Stay replacement changes only stay-linked route identity.

## F. Itinerary integration

The timeline derives compact travel transitions from current adjacent endpoint identities and current routes. Transitions show selected mode and, when calculated, provider distance/duration. They link back to Transport and share segment selection; they are not stored as independent itinerary activities.

## G. Map integration

The existing `InteractiveTripMap` accepts optional normalized overlays. `RouteOverlays` converts validated GeoJSON longitude/latitude to Leaflet latitude/longitude, leaves activity/Stay markers visible, highlights the selected route with semantic styling, focuses its bounds and handles overlay click through the shared segment selection. Invalid/missing geometry renders nothing.

## H. Schedule intelligence

For an activity-to-activity segment with current provider duration, the reusable conflict check compares previous scheduled end + travel seconds against the next scheduled start. It reports conflict or fits. Missing timing, hotel endpoints or missing routing data report unknown; the itinerary is never silently rescheduled.

## I. Route invalidation

Segment identity includes Trip, day and endpoint identities; route identity adds exact ordered coordinates, mode, provider options and data version. Add/remove/reorder/move edits, coordinate changes, stay replacement/removal and mode changes therefore stop incompatible results from rendering. Unaffected activity pairs can reuse current cache entries. Routes expire after five minutes and all result geometry clears on reload.

## J. API usage

Requests occur only after explicit calculation/compare actions, not during render. Day calculations are serial; compare fetches only the three supported modes for one selected segment. Abort signals cancel obsolete work. Duplicate requests share existing client handling, and the route adapter has a 100-entry/five-minute in-memory cache. Missing key, authentication, quota/rate limit, timeout, abort, unreachable route, malformed JSON and invalid provider data produce explicit states. Configuration/auth/quota failures stop the remaining batch.

## K. Light/Dark Theme

Local browser QA verified the Transport workspace, segment list, comparison table, schedule warning, markers and route overlays in Light and Dark themes. The map tiles were not inverted. Computed inactive/selected overlay strokes resolved from `--text-secondary` and `--accent-primary`, and selection remained distinguishable through line weight and row text/state as well as color.

## L. Responsive design

Desktop verification used the split list/map Transport layout and shared contextual sidebar. Tablet verification at 820 × 1000 retained usable controls and map. Mobile verification at 390 × 844 used the List/Map switch, wrapped controls, accessible touch targets and no horizontal page overflow. Browser screenshots are stored under `docs/verification/`.

## M. Files added

- `src/features/transport/domain/routing.ts`
- `src/features/transport/domain/planner.ts`
- `src/features/transport/services/routingProvider.ts`
- `src/features/transport/components/TransportProvider.tsx`
- `src/features/transport/components/TransportSegments.tsx`
- `src/features/transport/components/Transport.module.css`
- `src/features/transport/pages/TransportPage.tsx`
- `src/features/transport/tests/testData.ts`
- `src/features/transport/tests/routing.test.ts`
- `src/features/transport/tests/planner.test.ts`
- `src/features/transport/tests/workspace.test.tsx`
- `src/features/map/components/RouteOverlays.tsx`
- `dev/transport-qa.html`
- `dev/transport-qa.tsx`
- `docs/TRANSPORTATION_AND_ROUTING.md`
- `docs/PROMPT_08_REPORT.md`
- `docs/verification/prompt08-desktop-qa.png`
- `docs/verification/prompt08-mobile-qa.png`

## N. Files modified

- `.env.example`
- `README.md`
- `docs/PRODUCT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/ITINERARY_ENGINE.md`
- `docs/MAP_INTEGRATION.md`
- `docs/ACCOMMODATION_SYSTEM.md`
- `docs/IMPLEMENTATION_NOTES.md`
- `src/app/providers/TripsProvider.tsx`
- `src/app/routes.tsx`
- `src/features/places/services/geoapifyProvider.ts`
- `src/features/trips/types/trip.ts`
- `src/features/trips/services/TripRepository.ts`
- `src/features/trips/services/LocalStorageTripRepository.ts`
- `src/features/trips/components/TripWorkspaceHeader.tsx`
- `src/features/trips/components/TripWorkspaceLayout.tsx`
- `src/features/trips/components/TripContextSidebar.tsx`
- `src/features/itinerary/components/ItineraryTimeline.tsx`
- `src/features/itinerary/pages/ItineraryPage.tsx`
- `src/features/map/components/InteractiveTripMap.tsx`
- `src/features/map/pages/TripMapPage.tsx`
- `src/features/map/tests/InteractiveTripMap.test.tsx`

## O. Tests executed

- `npm test -- --run src/features/transport/tests/routing.test.ts src/features/transport/tests/planner.test.ts` — passed.
- `npm test -- --run src/features/transport/tests/workspace.test.tsx` — 6 passed.
- `npm test -- --run src/features/map/tests/InteractiveTripMap.test.tsx src/features/transport/tests/routing.test.ts` — 31 passed.
- `npm test` — 21 test files passed; 281 tests passed.
- `npm run build` — passed (`tsc -b` and Vite production build; 2,151 modules transformed).
- `npm run lint` — passed with no ESLint errors.
- `rg -n "QA ONLY|synthetic routes, not live provider calculations|Transport QA" dist` — no matches; the development-only transportation harness was excluded from the production bundle.

The tests cover coordinate order, three modes, request parameters/cache/expiry/abort/error states, malformed provider data, planner order, zero/one/multiple activities, stay origin/return/replacement/removal, missing coordinates, route invalidation, daily totals, conflicts, mode comparison, persistence/trip isolation, refresh behavior, missing key/rate limit and actual Leaflet polyline selection/removal.

## P. Local URL

Local verification used `http://127.0.0.1:5174/`. The production-shaped missing-key route and isolated QA harness were both served by the same existing Vite development server. No publish/deploy action was performed.

## Q. Known limitations

- No credential was available, so real Geoapify response/reachability/coverage acceptance is unverified.
- Public transit schedule coverage, timetable details, lines/stops and real-time departures are not implemented.
- `traffic=free_flow` provider estimates are not real-time traffic and are not labeled as such.
- Transport fares, tickets, taxi prices, fuel, tolls and parking remain unknown.
- Activities without valid coordinates cannot be routed; the system does not guess or bridge them.
- Provider quota, origin restrictions, plan limits, coverage and current service terms apply.
- First/last-day sightseeing timing remains provisional because arrival/departure transport is unknown.
- Route results are intentionally memory-only and expire/recalculate after reload; this avoids large/stale GeoJSON persistence.
- No turn-by-turn UI, public-transport detail, route optimization, offline routing or guaranteed travel time.

## R. Next phase

The repository is ready for **Prompt 09 — Budget Management & Cost Intelligence**. It exposes normalized provider route distance/mode/duration as read-only context while keeping every transportation monetary amount unknown. Prompt 09 must add a verified pricing source or explicit user estimate before creating transport expenses. No Prompt 09 code was implemented here.
