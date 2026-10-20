# Transportation and routing

## Scope

Prompt 08 implements local movement inside the destination. It derives connections from the current saved itinerary order and, when the user enables it, the current selected accommodation. It does not search flights, trains or intercity buses; optimize stop order; book transport; or estimate fares, fuel, parking or tolls.

The functional modes are:

| UI label | Geoapify mode | Status |
| --- | --- | --- |
| Walking | `walk` | Implemented |
| Driving | `drive` | Implemented |
| Cycling | `bicycle` | Implemented |
| Public transport | `transit` / `approximated_transit` | Not exposed: destination coverage, timetable semantics and live-departure behavior are unverified |

Route calculations are estimates, not guaranteed travel or arrival times. Driving results are not labeled as live traffic. The UI states that public traffic conditions, schedules and prices are not supplied.

## Provider and request architecture

The implementation uses the [Geoapify Routing API](https://apidocs.geoapify.com/docs/routing/) endpoint `GET https://api.geoapify.com/v1/routing`. `GeoapifyRoutingProvider` reuses the existing `GeoapifyPlacesProvider` singleton and its `RequestClient`; there is no second API client or credential. Requests contain:

- `waypoints` in ordered `latitude,longitude|latitude,longitude` form;
- one of `walk`, `drive` or `bicycle`;
- `units=metric`;
- `type=balanced`;
- `traffic=free_flow`;
- `optimize_stops=false`;
- the existing public `VITE_GEOAPIFY_API_KEY`.

Only an explicit Calculate day, Calculate route or Compare modes action issues routing calls. Compare requests each supported mode separately; it never scales one result to invent another. Segment requests are processed serially. Abort signals cancel work when the workspace unmounts or the active Trip changes. Existing request-client deduplication, timeout, rate-limit/backoff and bounded cache behavior apply, while the routing adapter adds route-identity caching.

Browser keys are public configuration, not private secrets. Restrict the key by allowed origins/referrers and quota in Geoapify. The application does not log it. Route calls transmit endpoint coordinates, requested mode and documented routing options, plus normal network metadata; they do not transmit the Trip title, budget, party details or notes.

## Coordinate handling and validation

`features/transport/domain/routing.ts` is the single coordinate-order boundary:

- normalized application point: `{ latitude, longitude }`;
- Geoapify waypoint string: `latitude,longitude`;
- GeoJSON position: `[longitude, latitude]`;
- Leaflet position: `[latitude, longitude]`.

Both numeric zeroes are valid. Latitude must remain within ±90 and longitude within ±180. Requests require 2–10 valid ordered points. Provider geometry accepts validated non-empty `LineString` or `MultiLineString` data only, with a maximum of 20,000 positions. Invalid types, non-finite values, bad ranges, empty lines, excessive data and malformed feature collections are rejected before map rendering.

Normalization also validates:

- exactly one usable route feature;
- provider mode association with the request;
- finite nonnegative distance in meters and time in seconds;
- one route leg and geometry line per requested connection;
- leg totals consistent with route totals within a small rounding tolerance;
- route geometry starting and ending within one kilometer of the requested endpoints.

A malformed, unreachable or missing route becomes unavailable. No straight-line fallback is constructed.

## Route and segment model

A normalized `TravelRoute` holds provider/source identity, request identity, functional mode, distance meters, estimated duration seconds, validated geometry, validated legs and a calculation timestamp. It is provider evidence, not an itinerary activity.

`planSegments` derives each `RouteSegment` from the actual current itinerary:

1. optional selected stay → first activity;
2. each adjacent activity pair in saved order;
3. optional final activity → selected stay.

The stay is never inserted as an attraction and is never assumed between activities. Without a selected/current stay, activity-to-activity routing still works. A day with one activity can have only an enabled stay connection; a day with zero activities has no requests. Missing endpoint coordinates create an explicit unavailable segment and are never bridged over to make a partial route look complete. A stale itinerary produces unavailable route planning until it is regenerated for current Trip context.

Segment identity includes Trip, day and endpoint identities. Route identity additionally includes ordered coordinates, mode, provider, routing options and a routing data-version string. This prevents a route from another Trip, previous stay, old adjacency, old coordinates or another mode from being presented as current.

## Preferences, invalidation and persistence

The first supported Prompt 02 transport preference becomes the initial mode: walking → `walk`, car → `drive`, bicycle → `bicycle`. Public transport does not silently become functional; when it is the only saved preference, the safe supported default remains walking and the UI explains transit's unavailable state.

Users may save a Transport default, override individual segment modes, and enable/disable stay origin and return connections. These settings use `TripRepository.saveTransportSettings` and the existing versioned Trip envelope. They do not overwrite global planner preferences. Malformed optional settings are isolated and preserved during unrelated Trip writes.

Itinerary add/remove/reorder/move operations change relevant endpoint identities, so incompatible routes and transitions disappear immediately. Stay replacement/removal affects only stay-linked identities; unchanged activity-to-activity route identities can still reuse a current cached result. Mode changes create a different route key, so walking geometry is never relabeled as driving. Browser reload restores itinerary and transport settings but intentionally not route results.

## Caching and request controls

The routing provider keeps at most 100 route entries in memory for five minutes, keyed by provider data version, ordered coordinates, mode and options. The workspace independently keeps only a bounded set of current routes/failures and expires displayed results after five minutes. This is session-only request reduction, not a permanent route database: geometry, legs, metrics and comparisons are not persisted or redistributed from localStorage.

Deployment owners must still review current [Geoapify terms](https://www.geoapify.com/terms-and-conditions/) and plan quotas. HTTP authentication/configuration errors, rate limits, timeouts, aborts, no-route results and malformed JSON are mapped to explicit states. After a configuration/authentication/rate-limit failure, a multi-segment action stops early rather than consuming more quota.

## Map overlays and shared selection

`InteractiveTripMap` remains the only Leaflet surface. `RouteOverlays` receives normalized routes, converts each validated GeoJSON line to Leaflet order and renders:

- a semantic neutral line for inactive segments;
- a slightly thicker semantic accent line for the selected segment;
- matching accessible list information with mode, distance, duration and status.

Markers for activities and the selected stay remain visible. Selecting a list row, clicking a route overlay or choosing the itinerary travel transition updates one shared selected segment. The selected overlay fits its bounds without recreating the map or resetting unrelated marker selection. When no current geometry exists, the map draws no substitute.

## Daily totals and itinerary timeline

Daily distance and travel duration sum only current successful provider routes. User-facing distance is meters for short routes and kilometers rounded to one decimal for longer routes. Duration rounds provider seconds up to whole readable minutes/hours. When any planned segment is missing, unavailable, stale or uncalculated, the total is explicitly incomplete; a partial numeric subtotal is never called the full day.

The Itinerary timeline inserts compact derived transitions between the corresponding activities and optional stay endpoints. Each transition shows current mode and, only after calculation, provider distance/duration. These blocks are not saved as activities and do not change the generator's schedule.

`detectTravelConflict` compares the previous activity's scheduled end plus provider duration with the next activity's scheduled start. It reports a conflict when the required travel would overlap. Missing prior/next timing, hotel-only timing or a missing route produces unknown—not “fits.” The application warns but never silently moves an activity.

## Accessibility and responsive behavior

Day and mode controls have text labels and keyboard-native controls. Selected rows expose state independently of color; conflicts and all unavailable/loading states have text. Route information remains available in the list if the map cannot load. On narrow screens the existing List/Map switch keeps a usable map rather than compressing the desktop split layout. Theme styling uses semantic tokens and does not invert provider tiles.

## Costs and Budget integration

Route results establish geometry, distance and estimated duration only. Taxi fare, tickets, fuel, tolls, parking and other costs remain unknown. Prompt 09 Budget exposes that missing coverage and allows a traveler to record an explicit manual transportation expense. It does not convert route mode or distance into money, and manual amounts are not presented as provider-verified route prices.

## Verification limitations

Unit and integration tests use mocked Geoapify envelopes against the real request builder, normalizer, planner, repository and UI. The isolated `dev/transport-qa.html` harness visibly labels its synthetic routes and uses sessionStorage, never the production Trip key. It verifies browser interaction and map lifecycle, not external provider connectivity.

No `VITE_GEOAPIFY_API_KEY` was available during Prompt 08. Therefore credentialed live route geometry, destination-specific reachability, traffic semantics and provider quota behavior remain unverified. Missing-key behavior is an expected supported state. The hosted site was not changed.
