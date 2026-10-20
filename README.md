# Smart Travel Planner

A focused React workspace for creating, reviewing, editing, and organizing trips and travel preferences.

## Setup

Requirements: Node.js 20.19+ (Node 24 recommended) and npm.

```bash
npm install
npm run dev
```

Open the exact local URL printed by Vite.

## Commands

```bash
npm run dev       # start the local development server
npm run build     # type-check and build production assets
npm run preview   # preview the production build
npm run lint      # run ESLint
npm test          # run the test suite once
```

## Implemented

- Original Route Frame SVG brand mark and favicon.
- Responsive desktop, tablet, and mobile application shell.
- Light, Dark, and System themes with persisted preference.
- Home, My Trips, New Trip, Trip Overview, and not-found screens.
- One planner for creation and editing, with Where & When, People & Budget, Travel Style, and Review sections.
- Accommodation, local transportation, interests, travel pace, and optional notes.
- Shared Zod validation and normalization in the planner and repository.
- Inclusive calendar-day and accommodation-night calculations.
- Create, review, list, open, edit, persist, reload, and delete trip flows.
- Unsaved-change protection for cancellation, app navigation, browser history, and reload.
- Older trips without preferences remain readable without rewriting their stored data.
- Nested Trip Workspace with a shared header, contextual Overview navigation, and the existing edit planner.
- Trip essentials, calendar days/nights, total budget, travel preferences, and optional notes presented in divided sections.
- Collapsible contextual navigation on tablet/mobile; global pages retain only global navigation.
- Invalid/missing trip links and storage failures have explicit recovery states. Damaged records are preserved while valid trips remain available.
- Versioned localStorage repository with invalid-data and storage-failure handling.
- Strict TypeScript, linting, and practical domain/repository tests.
- Deterministic itinerary scoring and scheduling, explicit Rome/Vienna demonstration mode, editable day timelines, trip-scoped persistence, and stale-plan detection.
- Interactive Leaflet map workspace with sourced coordinates, itinerary selection in both directions, day filtering, fit controls, and responsive List/Map views.
- Places workspace with explicit Geoapify destination confirmation, radius/category/name search, existing-engine ranking, details, duplicate-safe itinerary additions and persisted map coordinates.
- Identity-linked Wikimedia Commons media with validated licenses, visible attribution and neutral missing/error fallbacks.
- Local Transportation workspace with Geoapify walking, driving and cycling routes, per-segment mode choices, daily totals, schedule warnings and optional hotel origin/return connections.
- Provider route geometry on the existing Leaflet map with shared list/map/itinerary selection; route results remain short-lived memory data rather than localStorage payloads.
- Trip-scoped Budget workspace with one normalized expense ledger, itinerary-linked activity estimates, manual confirmed/estimated expenses, category and daily totals, deterministic insights, and explicit unknown-cost coverage.
- Searchable and sortable My Trips library with lifecycle filters, explicit open/edit/duplicate/delete actions, independent copy semantics, cross-tab refresh notices, stale-write protection, and a user-triggered versioned JSON backup export.
- Trip-scoped Travel & Flights workspace with honest provider availability, verified-airport search boundaries, planned offer selection, manual flight/train/bus/car/other journeys, schedule constraints, Overview summaries and source-linked Budget costs.

## Persistence and privacy

Trips are stored in the current browser using localStorage. There is no account, server database, collaboration, cloud synchronization, or automatic remote backup. Clearing browser storage removes saved trips. My Trips can download a versioned JSON backup, but Prompt 10 intentionally does not import or restore it. Other tabs on the same origin refresh after storage changes, and stale edits are rejected rather than silently overwriting a newer revision. Configured discovery sends destination text, search coordinates/categories/name and place identifiers to Geoapify. Route calculations send only ordered endpoint coordinates, routing mode and documented routing options to Geoapify; they do not send trip titles, budgets, traveler details or notes. Selected-place photo checks send a public Wikidata entity ID/file title to Wikimedia; thumbnails load from its image host. Map tiles disclose the viewed tile area to the configured provider. These requests also expose normal browser network information. No GPS permission is requested. Route geometry, distances and durations use bounded in-memory caching and are not persisted in localStorage.

## Current limitations

Live discovery and routing require an origin-restricted public `VITE_GEOAPIFY_API_KEY` in a local environment file and a Vite restart. No key was available during implementation: live geocoding, Places, details and Routing API access remain unverified; mocked integration tests exercise the actual adapters and response validation. Set `VITE_WIKIMEDIA_CONTACT` to a public application/contact identifier before deployment. See `docs/PLACES_AND_MEDIA_INTEGRATION.md` and `docs/TRANSPORTATION_AND_ROUTING.md` for setup and request behavior. Missing configuration never silently substitutes fixture results.

Unknown prices remain unknown. Venue durations use explicitly labeled planning assumptions; opening-hours syntax is preserved but not interpreted. Photos require a precise identity and acceptable author/license metadata; not every place has an eligible photo. Suggested times are not reservations or verified routes. Manual remove, reorder, move, and catalog-add operations are supported; direct time editing and single-day regeneration are not.

Optional **Geographic demonstration — sourced landmarks** adds static, source-checked Rome/Vienna landmark coordinate examples to the existing demo pool. Generic exercises remain unmapped. Existing saved itineraries are never automatically enriched or replaced. Map development defaults to OpenStreetMap standard tiles; production builds require an authorized tile URL and attribution configured through the public variables in `.env.example`. See `docs/MAP_INTEGRATION.md` before deploying.

Accommodation discovery supports bounded Geoapify property searches, preference/location ranking, factual comparison, and one persisted planned stay synchronized with Overview and Map. Live access still requires the same Geoapify key. Prices, availability, capacity and room arrangements remain unverified; selecting a stay is not booking it. See `docs/ACCOMMODATION_SYSTEM.md`.

Walking, driving and cycling routes are estimates returned by Geoapify, not guaranteed arrival times or live traffic predictions. Public transit is intentionally unavailable because destination coverage, timetable detail and live-departure behavior were not verified. Missing endpoint coordinates leave a segment unavailable, and a daily total is labeled incomplete whenever any segment lacks a current route. No fares, fuel, parking or toll costs are inferred.

Budget totals include only comparable amounts in the Trip currency. Itinerary activity costs are derived from the saved activity source and current traveler count; they are not copied into the manual ledger. Manual expenses can be added, edited and deleted. A manually entered amount in an older currency is preserved after a Trip currency change but excluded until explicitly updated, because no exchange rate is invented. Accommodation prices, transport fares, fuel, parking and tolls remain unknown unless the traveler records a manual expense.

Flight search requires a separately secured server endpoint configured with `VITE_FLIGHT_SEARCH_ENDPOINT`; no provider secret may be placed in a public `VITE_` variable. No endpoint or credential was available during Prompt 11, so live/sandbox inventory was not exercised and the product shows an unavailable state while retaining full manual planning. Manual airline, train and bus details are user-entered and are not operator-verified. Selected journeys are planned—not booked—and airport/hotel transfer time remains unknown. There is no authentication, remote backup, multi-device sync, booking integration, payment system, route optimization, automatic foreign-exchange conversion, receipt upload, or shared expense splitting. Prompt 12 adds a Trip-scoped deterministic assistant with grounded answers and explicitly confirmed action previews; no generative AI provider is connected. The supplied `logo.png` remains a project reference; the product UI uses the accessible theme-aware SVG component.

## Documentation

- `DESIGN_RULES.md` — permanent visual and interaction rules.
- `docs/PRODUCT_SPEC.md` — product goals and milestone boundaries.
- `docs/ARCHITECTURE.md` — code structure and provider strategy.
- `docs/IMPLEMENTATION_NOTES.md` — concise phase history.
- `docs/ITINERARY_ENGINE.md` — implemented rules, scoring, assumptions, and integration boundaries.
- `docs/PROMPT_04_REPORT.md` — phase verification and file inventory.
- `docs/MAP_INTEGRATION.md` — basemap configuration, licensing, coordinates and synchronization.
- `docs/PROMPT_05_REPORT.md` — map implementation and verification report.
- `docs/PLACES_AND_MEDIA_INTEGRATION.md` — Geoapify configuration, identity, Wikimedia licensing and request controls.
- `docs/PROMPT_06_REPORT.md` — discovery implementation, exact file inventory and verification limitations.
- `docs/ACCOMMODATION_SYSTEM.md` — property discovery, ranking, selection, images, costs and integration boundaries.
- `docs/PROMPT_07_REPORT.md` — accommodation verification, file inventory and provider limitations.
- `docs/TRANSPORTATION_AND_ROUTING.md` — routing contract, coordinate handling, cache policy, overlays, timeline integration and limitations.
- `docs/PROMPT_08_REPORT.md` — transportation implementation report, exact file inventory and verification evidence.
- `docs/BUDGET_MANAGEMENT.md` — expense model, derivation rules, persistence, cost coverage and limitations.
- `docs/PROMPT_09_REPORT.md` — Budget implementation report, file inventory and verification evidence.
- `docs/TRIP_PERSISTENCE.md` — authoritative record, migration, synchronization, duplication and backup policy.
- `docs/PROMPT_10_REPORT.md` — saved-trip management implementation and verification report.
- `docs/FLIGHTS_AND_LONG_DISTANCE_TRANSPORT.md` — provider boundary, normalized offers, manual journeys, schedule and Budget integration.
- `docs/PROMPT_11_REPORT.md` — Prompt 11 implementation and verification report.
- `docs/AI_TRAVEL_ASSISTANT.md` — local assistant, supported commands and safety boundaries.
- `docs/PROMPT_12_REPORT.md` — assistant implementation and verification report.
