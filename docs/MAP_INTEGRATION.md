# Interactive map integration

## Library and source boundary

Leaflet **1.9.4**, React-Leaflet **5.0.0** and `@types/leaflet` **1.9.21**. Registry peer dependencies for React-Leaflet 5 were checked before installation: React/React DOM `^19.0.0`, Leaflet `^1.9.0`, compatible with this project's React 19.3. The route is lazy-loaded, keeping Leaflet out of the initial application chunk. [React-Leaflet documentation](https://react-leaflet.js.org/docs/start-installation/) and [Leaflet reference](https://leafletjs.com/reference.html).

The existing Trip/Itinerary repository remains the source of truth. Map code does not create candidates, enrich records, geocode destination names, or persist markers. The adapter resolves saved item → catalog references and reuses `{latitude, longitude}`. Both must be finite numbers, latitude within ±90 and longitude within ±180. Numeric zero is valid. Missing, null, string and invalid locations remain unmapped; no `(0,0)` placeholder is created. A missing candidate remains a safe unavailable-details row. Cross-trip artifact IDs are refused.

## Tile provider, licensing and configuration

Local development defaults to `https://tile.openstreetmap.org/{z}/{x}/{y}.png` with visible linked **© OpenStreetMap contributors** attribution. Use is limited and follows the [OSMF tile policy](https://operations.osmfoundation.org/policies/tiles/): normal browser Referer/cache behavior, HTTPS, only viewport requests, no cache bypass, bulk download, background scans, offline caching or prefetch feature. No custom proxy is introduced. Standard basemap tiles retain their original style in Light and Dark themes; surrounding controls and popups use semantic tokens, not tile-inversion filters.

Production builds deliberately have **no default provider**. Select a provider authorized and sized for the expected audience/traffic, confirm its terms, then configure these public build-time variables (names also in `.env.example`):

- `VITE_MAP_TILE_URL`: permitted HTTPS raster template containing `{z}`, `{x}`, `{y}`.
- `VITE_MAP_ATTRIBUTION_TEXT`: required provider/data attribution text.
- `VITE_MAP_ATTRIBUTION_URL`: HTTPS license/attribution link.
- `VITE_MAP_MAX_ZOOM`: supported maximum, default 19; integer 1–22.

Put deployment-specific public configuration in an ignored environment file or hosting build settings and rebuild. Invalid/incomplete configuration shows a provider-configuration state without losing itinerary access. Additional provider credits can be included in attribution text; exact contractual attribution requirements must be reviewed for the selected service. Private API credentials must never appear in frontend variables. Providers requiring public browser tokens should use their allowed domain restrictions. OSM community servers provide no service guarantee; do not assume they authorize arbitrary production scale.

Tile requests disclose normal browser network metadata and the viewed tile area to that provider. Trip titles, budgets, party sizes and notes are not sent. No GPS location request is made. No remote service is called for zero markers. There is no confirmed destination coordinate model, so the zero-location state does not pretend to center on the destination.

## Marker transformation and synchronization

Rows retain the stable itinerary item ID, candidate ID, day ID/date/number and current order. Only valid located rows become markers; map coverage counts both mapped and unmapped rows under the active filter. Labels use `day.activity` in both selected-day and All-days mode, not ambiguous repeated numbers or a verified route sequence. Candidate/provider IDs remain available through references for future providers.

One page-local `{dayId, itemId}` state owns selection. List selection highlights/focuses the same marker and opens its metadata popup. Marker selection highlights and scrolls the matching list row without stealing keyboard focus. Selection details reuse the existing ActivityDetailsDialog. Selection of an unmapped row still provides meaningful details but does not focus a substituted location. Invalid selection is cleared when filtering, removing an item or switching trips. Preserved stale itineraries are explicitly labeled; old markers are not presented as a newly planned destination.

Itinerary rows link to `/trips/:tripId/map?item=<stableId>`. Map selection links back to `/trips/:tripId/itinerary?day=<dayId>&item=<stableId>`, opening and highlighting the correct day occurrence. Query parameters are validated against the actual current artifact; unknown IDs do not manufacture data. Markers automatically derive from the updated Trip after remove/add/reorder/move saves. There are no extra storage keys or coordinate models.

## Viewport and lifecycle

No markers: explanatory geographic state, existing list retained, Fit disabled, no guessed center. One location (or coincident points): center at zoom 14, limited by provider maximum. Multiple locations: padded bounds with max zoom 15, respecting provider maximum. Longitude bounds use the smallest circular arc across the antimeridian; display-world longitude wrapping does not alter stored coordinates. Invalid locations cannot corrupt bounds. Standard Web Mercator basemaps do not faithfully depict polar extremes despite those coordinates being numerically valid; other projections need a future provider decision.

Initial view and location/filter changes fit valid visible locations. Explicit Fit clears selection and fits the active set. Explicit selection focuses that location. Theme changes and unrelated page state do not continuously reset manual pan/zoom. Zoom controls and keyboard/drag pan are Leaflet's genuine controls; wheel zoom is disabled to avoid trapping workspace scrolling.

React-Leaflet owns container initialization/removal, including Strict Mode. Stable marker keys and memoized event/icon data avoid unrelated map recreation. A ResizeObserver refreshes visible container dimensions and preserves center without animation. Focus/fit explicitly refresh size first, fixing cached dimensions when returning from a hidden mobile panel. Observer cleanup happens on unmount. No panning state is continuously copied into React.

## Layout and accessibility

Desktop split surface uses approximately 38% list / 62% map, with independent list scrolling and a 521px map. Tablet retains a practical split when space permits. At 760px and below, List/Map controls switch the same panels; both share selection/filter state. Selecting a list row does not force a view switch; View location is an explicit action. Mobile map height is at least 400px or 60dvh. Resize behavior handles sidebar collapse and panel visibility.

Rows are buttons with pressed state and explicit day/order labels. Marker buttons receive landmark/day/order accessible labels and keyboard support. The list provides a full non-map alternative; details are available without markers. Controls are labeled, focus styles are retained, and attribution remains visible in each map view. No meaning relies only on color. When current provider routes exist, the Map and Transport workspaces render the same restrained selectable overlays and expose matching distance/time text outside the map.

## Error handling

- Lazy route: restrained loading message.
- Tile batch: loading status; tile errors show a distinct temporary-unavailability notice and Retry tiles. Markers/list remain accessible. Retry remounts the tile layer, using normal browser cache behavior.
- Map initialization: React error boundary with Retry map, keeping the list and workspace intact.
- Provider configuration: specific setup state, not an empty-activities claim.
- Missing coordinates: explicit geographic empty state and unmapped activity labels.
- Missing/corrupt itinerary: existing repository diagnostics and link to Itinerary; no replacement artifact is saved by Map.

## Geographic demonstration provenance

**Geographic demonstration — sourced landmarks** is an explicit separate candidate adapter, dynamically imported only when chosen for generation. It appends four static fixture examples to the generic fixture pool. Old saved plans and generic demo mode are not modified. These are landmark points, not surveyed entrances or live venue results. All four have unknown price, hours, availability and duration; the engine labels its duration assumption.

Coordinates were checked on 2026-10-14 against Wikidata P625 statements and converted from degrees/minutes/seconds without offsets:

| Destination / landmark | Source point | Source |
| --- | --- | --- |
| Rome / Colosseum | 41°53′25″N, 12°29′32″E | [Q10285](https://www.wikidata.org/wiki/Q10285) |
| Rome / Pantheon | 41°53′55″N, 12°28′37″E | [Q99309](https://www.wikidata.org/wiki/Q99309) |
| Rome / Trajan's Forum | 41°53′43.51″N, 12°29′9.13″E | [Q211295](https://www.wikidata.org/wiki/Q211295) |
| Vienna / St. Stephen's Cathedral | 48°12′30.337″N, 16°22′23.722″E | [Q5943](https://www.wikidata.org/wiki/Q5943) |

The source IDs and snapshot labels are saved in candidate metadata; descriptions cite source URLs. This small development set is not a live Places adapter or an endorsement of present opening status. No generic activity receives a fabricated coordinate.

## Route overlays and limitations

Prompt 06 normalizes Geoapify coordinates/provider IDs through the existing candidate model. Adding a discovered place saves it through the existing itinerary mutation/repository; the unchanged map adapter derives its marker from the catalog reference. No disconnected discovery-marker store or second map was added. Planned-place links select existing occurrences. Details reuse saved Commons media and attribution; mixed sources remain explicitly labeled. Unsaved discovery map previews are not implemented. Live Geoapify marker provenance is covered by mocked adapter/persistence tests, not a credentialed live search. See `PLACES_AND_MEDIA_INTEGRATION.md`.

Prompt 08 supplies genuine Geoapify geometry, distance and duration through a deliberate overlay contract. `InteractiveTripMap` still owns the only Leaflet container. Validated `LineString`/`MultiLineString` coordinates are converted centrally, activity and Stay markers remain visible, and selected/inactive routes use semantic accent/neutral tokens with different weights. List selection, overlay click and itinerary transition share one selected segment; selected geometry fits its bounds without recreating the map. No straight-line fallback is drawn when routing is absent or invalid.

The map does not calculate or persist routes. It receives short-lived normalized overlays from the Trip Workspace transport context. Itinerary/stay/mode changes make incompatible overlays disappear, and browser reload intentionally clears route geometry. There is no route optimization, turn-by-turn directions UI, public-transit line/timetable visualization, flights, geolocation, bookings or availability. Markers at identical coordinates can overlap; the list remains available, with clustering deferred until real-data scale warrants it. See `TRANSPORTATION_AND_ROUTING.md`.
