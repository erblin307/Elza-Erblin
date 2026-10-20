# Implementation Notes

## Phase 11 — flights and long-distance transportation

- Added a distinct Travel & Flights domain, route and Trip-owned versioned artifact without changing local destination routing.
- Added normalized flight/segment/airport/baggage/party-price/expiry contracts; a secured endpoint adapter with validation, cancellation, deduplication, rate/timeout/error handling; and an honest unavailable adapter because no credentials exist.
- Added full manual flight/train/bus/car/other add/edit/remove planning with timezone uncertainty preserved and no booking implication.
- Integrated outbound/return constraints into itinerary generation and non-destructive conflict warnings; integrated current comparable costs into the existing Budget engine with round-trip deduplication, expiry and payment reconciliation.
- Added Overview summaries, persistence/duplication behavior, focused tests and an isolated visual QA harness. See `FLIGHTS_AND_LONG_DISTANCE_TRANSPORT.md` and `PROMPT_11_REPORT.md`; stopped before Prompt 12.

## Phase 10 — saved trips and persistence hardening

- Turned My Trips into a local management library with normalized search, lifecycle filters, stable sorting and visible Open, Edit, Duplicate, Delete and Export actions.
- Kept one authoritative Trip aggregate and repository; added controlled legacy migration, monotonic revisions, optimistic stale-write rejection, same-origin tab refresh and quota-specific recovery guidance.
- Added deterministic independent duplication with fresh parent/child IDs and explicit per-module copy policy. Confirmed spending and transient route results are not copied.
- Added versioned user-triggered JSON backup export without pretending import, accounts, cloud sync or automatic recovery exists.
- Added edit-impact review and stale itinerary cost exclusion so destination/date/context changes do not silently relabel incompatible linked Budget totals.
- Added persistence acceptance, library domain, storage-event and UI-management coverage plus an isolated synthetic Trip-management QA harness. See `TRIP_PERSISTENCE.md` and `PROMPT_10_REPORT.md`; stopped before Prompt 11.

## Phase 09 — budget management and cost intelligence

- Added a lazy Trip Budget route and contextual navigation without creating a second Trip store.
- Added a versioned, Zod-validated manual expense ledger to the existing repository with ownership checks, duplicate-ID protection and malformed-ledger preservation.
- Derived itinerary activity expenses from existing per-person, per-group and per-entry source costs; no copied linked rows or invented prices.
- Added confirmed/estimated split, category and day totals, remaining/over-budget status, explicit source coverage and deterministic insights using cent-based arithmetic.
- Accommodation and transport remain visible but unknown because current providers do not expose authoritative monetary totals.
- Added focused domain, persistence and page tests plus a visibly synthetic sessionStorage QA harness. See `BUDGET_MANAGEMENT.md` and `PROMPT_09_REPORT.md`.

## Phase 08 — local transportation and routing

- Added Geoapify `/v1/routing` behind the existing HTTP client, with walking, driving and cycling requests, central coordinate-order conversion and strict distance/duration/leg/GeoJSON validation.
- Derived segments from authoritative itinerary order plus optional current Stay origin/return anchors. Added per-segment modes, daily incomplete totals and reusable schedule-conflict checks without reordering activities.
- Extended the existing Leaflet map with selectable provider polylines and one shared segment selection across Transport, Map and compact itinerary transitions. No straight-line fallback or second map exists.
- Persisted only bounded transport choices in the existing Trip repository. Geometry and route metrics remain expiring in-memory data; route/cache identities invalidate incompatible itinerary, stay, coordinate, mode and options changes.
- Added request cancellation, serial calculation, bounded caching, missing-key/quota/unreachable states and explicit unavailable transit/fares/live-traffic messaging.
- Verified domain/provider/repository/workspace/Leaflet behavior with mocked envelopes and isolated browser QA across desktop, tablet, mobile, Light and Dark themes. No Geoapify key was available, so live-provider acceptance is not claimed and the hosted site was not changed.
- See `TRANSPORTATION_AND_ROUTING.md` and `PROMPT_08_REPORT.md`; stopped before Prompt 09.

## Phase 06 — Places and licensed media

- Added Geoapify city/Places/details adapters, validated per-record normalization, explicit destination confirmation and bounded category/name/radius discovery.
- Extended the existing candidate/context/Trip/repository contracts; reused ranking, scheduling, mutation, catalog persistence and derived map markers. Prior artifacts/manual work remain preserved and relevant context changes are stale, not overwritten.
- Added exact Wikidata/P625/P18-to-Commons resolution, conservative license/attribution validation and one reusable image component with neutral fallbacks.
- Added missing-key/auth/quota/timeout states, debounce, cancellation, bounded memory cache and serial selected-detail media requests.
- Verified mocked provider/media/persistence/UI contracts and local fixture-based desktop/mobile/tablet flows. Geoapify live access awaits a public origin-restricted key; the browser Commons attempt returned no usable image, so successful live photography is not claimed.
- Used the Sites local-preview workflow for actual browser verification. No publishing, second shell/map/store, unrelated feature, hotel system or Prompt 07 implementation.
- See `PLACES_AND_MEDIA_INTEGRATION.md` and `PROMPT_06_REPORT.md` for actual limits and exact files.

## Phase 05 — Interactive map

- Reused the Trip Workspace, saved itinerary catalog/references, repository, controls, theme tokens and details dialog.
- Added one Leaflet/React-Leaflet working surface, validated derived markers, one shared selection, day filtering, viewport fitting and accessible List/Map controls.
- Isolated public tile configuration and provider/error handling; retained visible attribution and unaltered basemap styling. No routing, GPS, geocoding or live Places integration.
- Added explicitly selected geographic fixtures with cited static landmark coordinates; prior generic samples and saved plans remain unchanged.
- Verified real tiles, both selection directions, cross-day move/reload behavior, themes and responsive layouts. Fixed hidden-panel resize/focus behavior; added adapter, real Leaflet lifecycle and repository-backed UI tests.
- Bounded Vitest concurrency to four workers and allowed three seconds for async lazy-route queries to avoid desktop scheduling timeouts without relaxing domain assertions.

## Phase 03 — Trip Workspace

- Added one nested layout with validated repository loading, shared Trip context, contextual Overview navigation, and compact persistent header.
- Organized the Overview into real trip essentials, calendar duration/nights, total budget, and preferences; reused the planner for contextual editing.
- Added responsive contextual navigation, explicit loading/not-found/error states, and recovery without duplicate Trip stores.
- Isolated damaged/duplicate records, preserving their raw data and unmanaged fields during healthy-trip mutations; guarded disabled-storage access.
- Added integration tests against the real route tree and repository; verified independent trips, editing/reload consistency, both themes, and desktop/tablet/mobile browser behavior.

## Phase 02 — Professional trip planner

- Reused the shell, brand, themes, controls, Trip model, Zod validation, and storage adapter.
- Added normalized travel preferences and one controlled planner for creation and editing, with review before saving.
- Added safe repository updates, legacy-record compatibility, inclusive days/nights, duplicate-submit prevention, and unsaved-change protection.
- Extended validation, repository, date arithmetic, and interaction tests; verified creation, opening, editing, reload persistence, themes, and responsive layouts locally.

## Phase 01 — Foundation

- Initialized one Vite/React/TypeScript application in the repository root.
- Created the Route Frame SVG component and matching favicon from shared geometry.
- Added semantic Light/Dark/System themes with pre-render theme application.
- Implemented the responsive navigation shell and four required routes plus not-found handling.
- Added strict Trip domain validation and a versioned localStorage repository abstraction.
- Implemented working create, list, open, and confirmed delete flows with honest local-persistence messaging.
- Added validation and repository tests plus product, architecture, design, and operating documentation.

## Phase 04 — itinerary engine

Reused the workspace, planner, preference/date validation, tokens, controls and version-1 trip repository. Added a pure deterministic engine, candidate adapter boundary, isolated explicit demo fixtures, schedule/cost validation, editable editorial timelines, trip-scoped artifact persistence, corrupt-artifact isolation and stale detection. No live provider or map was added. See `ITINERARY_ENGINE.md` and `PROMPT_04_REPORT.md` for actual rules, checks and limitations.

## Phase 07 — accommodation

Reused the Geoapify client/request controls, shared geographic normalization, existing Trip repository, TravelImage, workspace themes/navigation and Leaflet map. Added bounded property discovery, explainable type/proximity ordering, three-property factual comparison, lazy details/media and one persisted planned stay with replace/remove/review handling. Overview and map derive the same stay without mutating itinerary activities. Prices and availability remain unknown. No commercial adapter, backend, checkout or Prompt 08 work was added. Local browser QA uses explicitly labeled mocked responses and isolated storage because Geoapify credentials are unavailable. See `ACCOMMODATION_SYSTEM.md` and `PROMPT_07_REPORT.md` for verification and limits.

## Prompt 12 — context-aware local assistant

Added Trip-scoped grounded questions, deterministic commands, before/after
proposals and revision-checked confirmation through existing services. Chat is
bounded memory only; saved changes use existing Trip persistence. No LLM backend
or credentials are configured. External alternatives/routes use existing
providers only and fail honestly when unavailable. Isolated development QA and
safety regression coverage are documented in `PROMPT_12_REPORT.md`.
