# Prompt 05 — interactive map implementation report

## Existing code audit and reuse

COMPLETE and reused: Trip Workspace/Outlet context, contextual navigation, TripRepository/TripsProvider and local itinerary persistence; normalized optional candidate location/provider ID; pure itinerary generation/editing, day/order references, calendar formatting; Route Frame branding, semantic themes, Button, and ActivityDetailsDialog. PARTIAL before this phase: map-ready coordinate fields and architectural boundaries only. MISSING: map library/provider configuration, marker adapter, geographic bounds, map route, synchronized selection and responsive map panels. No broken prior module required replacement. Existing uncommitted phase work was retained.

## Map technology and provider licensing

One renderer: Leaflet 1.9.4 with React-Leaflet 5.0.0 and @types/leaflet 1.9.21. Peer compatibility with installed React/React DOM 19.3 was verified against the npm registry. The map route is lazy-loaded. Development uses the standard HTTPS OSM raster source with visible linked attribution, default browser Referer/caching and viewport-only requests. No offline cache, bulk download, scraping, fake route lines or tile inversion. Production requires explicit permitted tile-provider configuration; see `.env.example` and `MAP_INTEGRATION.md`.

Policy/reference sources: [OSMF tile usage policy](https://operations.osmfoundation.org/policies/tiles/), [Leaflet reference](https://leafletjs.com/reference.html), [React-Leaflet installation](https://react-leaflet.js.org/docs/start-installation/). No production tile entitlement or availability guarantee is claimed.

## Geographic data

The map resolves actual saved itinerary references into existing candidate metadata. Latitude/longitude must be finite numeric values within geographic ranges; zero is valid. Missing candidate/coordinate rows stay accessible without substituted destination positions. Bounds exclude invalid coordinates and handle the antimeridian. Trip IDs isolate artifacts and UI selection.

Prior generic fixtures have no locations and were not altered. A separate explicitly selected Geographic demonstration provider appends static landmark snapshots: Colosseum, Pantheon, Trajan's Forum in Rome and St. Stephen's Cathedral in Vienna. Coordinates were checked against cited Wikidata P625 records; descriptions and source IDs disclose provenance. No ticket costs, hours, duration, availability, route positions or entrance locations were invented. This is not live discovery. Existing saved itineraries are not automatically enriched or regenerated.

## Synchronization and selection

- List → Map: stable item selection highlights a marker, focuses its coordinate and opens truthful metadata.
- Map → List: the same selection highlights/scrolls the corresponding ordered row.
- Filtering: real day IDs or All days drive both rows and markers; invalid selection clears.
- Updated itinerary: addition/removal/reorder/move automatically changes derived markers from the current workspace Trip, without marker storage or browser reload.
- Trip switching: keyed page state resets, with no unrelated markers retained.
- Navigation: itinerary rows deep-link to their map occurrence; map selection opens/highlights the exact itinerary day/occurrence.
- Missing locations: selection still opens details and explains why no marker can appear.

## Workspace design and accessibility

Desktop uses a restrained approximately 38/62 list/map split, not dashboard cards. The ordered list scrolls independently; the map is a 521px working surface. Tablet adapts the split. At 760px and below, List/Map controls share state and display one useful panel; map height is at least 400px/60dvh. Row selection does not force mobile view changes; View location is explicit.

Markers identify day.activity order, not routes. Accessible names include landmark/day/order, keyboard controls work, pressed states identify selection, and details are also accessible through the list. Source disclosures, missing-location labels, attribution and theme-compatible surrounding controls remain visible. Standard basemap styling is retained in Dark Theme.

## Viewport, lifecycle and performance

Zero points produce an honest geographic state without tile requests or guessed center. Single/coincident points center at a reasonable zoom; multiple points use padded bounds. Explicit Fit respects the current filter. Selection focuses a point; unrelated theme/UI changes do not continually recenter manual navigation. React-Leaflet manages creation/removal, marker keys remain stable and derived arrays/callbacks are memoized. ResizeObserver cleanup and visible-container size invalidation handle layout changes. Browser QA found and fixed cached dimensions after a hidden mobile panel; focus now refreshes size before centering.

Map loading, tile failures/retry, initialization failure/retry, missing configuration, missing coordinates and corrupt/missing itinerary are distinct states. The list remains accessible when rendering or tiles fail. No generator, persistence or provider discovery logic is duplicated into Leaflet code.

## Tests executed

- Final `npm test`: **148 tests passed across 11 files**. Existing 106 tests retained; 42 map tests added.
- Map adapter/config/provenance suite: 24 cases, including zero/numeric bounds, invalid/missing/NaN/Infinity/string coordinates, missing references, stable IDs, filtering, correct day/order, mutations, isolation, zero/single/multiple/coincident/wide/antimeridian bounds, production setup and source fixtures.
- Repository-backed map route suite: 11 cases, including both selection directions, filter reset, unmapped-only days, fit/reset, real details, deep links, actual remove/save/reload, same-mounted-page removal, mobile-view state, preserved stale data and two independent located itineraries.
- Leaflet/list integration suite: 7 cases using actual MapContainer/markers/popups with tile transport isolated. Covers fit/focus, no unnecessary refits, stable-ID callbacks, tile failure/retry, zero locations, resize, Strict Mode mount/unmount, and a selected-row panel-scroll regression.
- `npm run build`: passed, including `tsc -b`. Main JS 481.51 kB; separate map JS 166.47 kB; geographic fixture JS 2.50 kB.
- `npm run lint`: passed.

Initial failures were corrected: unnecessary floating-point longitude perturbation, asynchronous lazy-route query timing under desktop worker load, Leaflet's mutation of options in spy assertions, responsive-control visibility in jsdom, and a TypeScript query option mismatch. Browser checks also corrected hidden-panel focus sizing and selected-row scroll offsets; both have regression coverage. Test concurrency is capped at four; async query timeout is three seconds. Domain assertions and functional limits were not weakened.

## Local browser verification

Actual application at `http://127.0.0.1:5174/`:

1. Existing saved generic Rome itinerary displayed 0 of 13 activities mapped without invented positions.
2. A separate browser acceptance trip was created using the requested Prishtina → Rome, June 12–17 2027, two travelers, EUR 1,500, balanced History/Architecture/Food inputs. No production trip seeding was added.
3. Explicit Geographic demonstration generation saved 16 activities, of which three sourced landmarks were mapped. Real OSM tiles loaded and aligned with Colosseum/Pantheon/forum locations; attribution remained visible.
4. Day 2 showed only its located activity; list selection focused Colosseum and opened its actual source/assumption popup. Clicking Pantheon's marker selected and scrolled the matching Day 3 row. All-days and Fit worked.
5. Map → Itinerary opened the correct day/occurrence. Moving Colosseum from Day 2 to Day 5 changed the map filter from zero Day 2 markers to a Day 5 marker labeled 5.4. Reload retained the move and proposed time 15:00.
6. Zoom control and keyboard pan were exercised; browser warning/error logs were empty.
7. Desktop Light/Dark, 390×844 mobile List/Map/explicit View location, and 768×1024 tablet split layouts were visually inspected. Selected landmarks remained focused after returning from a hidden panel. Document widths equaled viewport widths (390 and 768), without page horizontal overflow.
8. Removal, same-mounted-page data updates, isolated second geographic itinerary, invalid inputs and tile/init lifecycle behavior have automated coverage. Browser removal was not repeated; no previously saved user activity was deleted.

Screenshots: `docs/verification/prompt05-desktop-light.jpg`, `prompt05-desktop-dark.jpg`, `prompt05-mobile-light.jpg`, `prompt05-mobile-dark.jpg`, `prompt05-tablet-dark.jpg`. Full-page mobile captures can place fixed header/bottom navigation at their current viewport offsets; normal live views remain correctly fixed.

## Files added

- `.env.example`
- `src/features/map/domain/mapData.ts`
- `src/features/map/services/tileConfig.ts`
- `src/features/map/components/MapActivityList.tsx`
- `src/features/map/components/InteractiveTripMap.tsx`
- `src/features/map/components/MapWorkspace.module.css`
- `src/features/map/pages/TripMapPage.tsx`
- `src/features/map/tests/mapData.test.ts`
- `src/features/map/tests/TripMapPage.test.tsx`
- `src/features/map/tests/InteractiveTripMap.test.tsx`
- `src/features/itinerary/fixtures/GeographicFixtureActivityProvider.ts`
- `docs/MAP_INTEGRATION.md`
- `docs/PROMPT_05_REPORT.md`
- Five map verification screenshots listed above.

## Files modified

- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `src/test/setup.ts`
- `src/app/routes.tsx`
- `src/features/trips/components/TripContextSidebar.tsx`
- `src/features/trips/components/TripWorkspaceHeader.tsx`
- `src/features/itinerary/services/itineraryGenerator.ts`
- `src/features/itinerary/pages/ItineraryPage.tsx`
- `src/features/itinerary/components/ItineraryTimeline.tsx`
- `src/features/itinerary/components/Itinerary.module.css`
- `README.md`
- `docs/PRODUCT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/ITINERARY_ENGINE.md`
- `docs/IMPLEMENTATION_NOTES.md`

## Local URL, limitations and next phase

Local URL: `http://127.0.0.1:5174/`. Browser acceptance map: `http://127.0.0.1:5174/trips/8b3b6e84-4e66-47ef-afe4-1655bdaefcf1/map`. Its data belongs only to the local browser used for verification. The hosted Site was not republished. The Sites skill guided local preview and explicit deployment/provider boundaries.

Live Places discovery, geocoding, directions, route geometries, distance/travel-time calculations, hotel/flight search, bookings, payments and authentication remain out of scope. Static demo landmark coordinates are not entrances or availability guarantees. A production tile provider must be explicitly configured and licensed for expected use. Coincident markers can overlap; the list preserves access. Sparse/ranked fixture plans may leave some landmarks unscheduled. Web Mercator has polar display limitations.

Ready for **Prompt 06 — Real Places & Activities Discovery Integration**, through the existing candidate model/provider IDs. No automatic implementation of that phase was started.
