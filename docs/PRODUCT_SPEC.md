# Product Specification

## Product goal

Smart Travel Planner is a practical workspace for organizing a journey from initial route and dates through a future detailed itinerary. It should make planning legible and calm while keeping the traveler in control of real information.

## Target users

- Individuals organizing a personal trip.
- Families or small groups establishing dates, party size, and budget.
- Detail-oriented travelers who will later build day-by-day plans.

## Main workflow

1. Enter origin, destination, calendar dates, travelers, total budget, and currency.
2. Select accommodation, local transportation, interests, travel pace, and optional notes.
3. Validate and review the complete plan before saving.
4. Save locally through the repository and open the trip overview.
5. Reopen through My Trips, edit using the same planner, or delete after confirmation.
6. Open Itinerary, select an available source, and generate a proposed schedule from the saved trip.
7. Review source/cost limitations, edit activities, and preserve changes locally. Regeneration requires confirmation.
8. Explore saved activity locations in the Map workspace, filter by day, and navigate between markers and itinerary rows.
9. Calculate provider-backed local connections in itinerary order, compare supported modes for one segment, review daily totals and return to the itinerary with travel transitions visible.
10. Open Budget to review comparable known costs, record manual expenses, inspect category/day totals and see deterministic budget insights without treating unknown prices as zero.
11. Manage the complete journey in My Trips: search, filter, sort, reopen, edit, duplicate independently, delete deliberately, and export a versioned local backup.
12. Plan outbound/return long-distance journeys with secured flight search when configured or manual travel entry; review schedule and Budget impact without implying booking.

## Planned modules

Trips, Itinerary, Map, Places, identity-linked Media, Accommodation, local Transportation, Budget, long-distance Travel/Flights and a Trip-scoped deterministic Assistant are implemented domains. The Assistant requires confirmation for changes; no generative language provider is connected.

## Current milestone

Milestone 11 adds planned long-distance transportation as a distinct Trip-owned domain. It provides one-way/round-trip flight search through a secure normalized endpoint when configured, honest unavailable behavior otherwise, and working manual flight/train/bus/car/other planning. Planned journeys constrain boundary-day itinerary generation, produce non-destructive conflict warnings and contribute current comparable costs to the existing Budget projection. A planned journey is never labeled booked.

The version-1 localStorage envelope remains the canonical source. Controlled legacy shapes are read without eager mutation and upgraded on the next successful write. Same-origin tabs refresh after storage events, while expected-revision checks reject stale writes. Malformed records remain preserved and isolated. See `TRIP_PERSISTENCE.md` and `PROMPT_10_REPORT.md`.

## Future milestones

1. Full application integration, production hardening and quality review (Prompt 13; not implemented automatically).
2. Optional account-backed synchronization and additional verified commercial inventory.

Each future integration requires a documented provider contract and must not be presented as functional before it is implemented and verified.

## Milestone 11 — flights and long-distance transportation

Travel & Flights is available at `/trips/:tripId/travel`. The browser build contains no commercial credential. `VITE_FLIGHT_SEARCH_ENDPOINT` may point to a secured adapter that owns Duffel credentials and returns normalized airport/offer data; test and live environments remain distinct. Provider offers retain segments, local times, timezone evidence, party-total cost identity and expiry. Manual journeys preserve local time without manufacturing an instant when timezone evidence is absent.

Outbound arrival and return departure supply first/last-day constraints. Existing itineraries are preserved and conflicts are reported instead of triggering regeneration. Current comparable costs are derived into the existing Budget engine, round-trip totals share one identity, expired/outdated quotes are excluded, and a reconciled manual payment suppresses the estimate without changing booking status. See `FLIGHTS_AND_LONG_DISTANCE_TRANSPORT.md`.

## Milestone 7 — Accommodation

The Stay workspace searches real-provider property records through the existing Geoapify adapter. It supports property-type/name/radius filters, deterministic preference/proximity ordering, factual comparison, on-demand details, conditional identity-linked Commons imagery, and a single primary planned stay. Selection persists in the existing Trip repository and appears in Overview and the existing Leaflet map without modifying itinerary activities. Dates or travelers changing triggers review of the retained stay. Zero-night trips cannot select an overnight stay. No live prices, availability, booking or invented expenses are supplied. Live Geoapify verification remains blocked by missing credentials; local QA uses explicitly labeled isolated fixtures, never production fallback data.

## Milestone 8 — Local transportation and routing

The Transport workspace supports ordered activity-to-activity segments and optional selected-stay origin/return segments. Walking, driving and cycling use separate provider calculations; comparison never derives one mode from another. Valid provider routes contribute actual meter/second totals, map geometry and schedule checks. Missing coordinates, provider failures, stale itinerary context and uncalculated segments remain explicit. Public transit, live traffic, fares, optimization, long-distance travel and booking are outside this milestone.

## Milestone 9 — Budget management and cost intelligence

The Budget workspace owns one normalized manual ledger per Trip and derives source-linked activity costs from the saved itinerary. Per-person, per-group and per-entry activity pricing follows the existing itinerary rules. Only finite nonnegative values in the current Trip currency contribute to totals; unknown or mismatched-currency sources remain visible as incomplete coverage. Users can add, edit and delete manual expenses with category, certainty, optional date and note. Summaries use cent-based arithmetic and include category/day totals, confirmed/estimated split, remaining or over-budget state, and deterministic—not AI-generated—insights. Accommodation and local transport supply coverage context only because no authoritative price source exists.

## Milestone 10 — saved trips and persistence hardening

My Trips is the browser-local management hub for the canonical Trip aggregate. It supports normalized title/destination/origin search; All, Upcoming, In progress and Past filters; stable sort choices; direct Open and Edit links; independent duplication; explicit deletion; and versioned JSON export. Dates are classified using local calendar dates. Empty-library and no-match states are distinct.

Core edits preserve optional planning artifacts but visibly explain cross-module consequences. Destination, date and preference changes can make saved itinerary/stay/route context stale; traveler changes recalculate per-person cost projections; currency changes never convert older manual amounts. Storage remains local-only, with no accounts, server sync, automatic backup or import.
