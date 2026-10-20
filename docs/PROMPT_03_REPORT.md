# Prompt 03 — Trip Workspace Report

Project directory: `C:\Users\ComputerShop\Desktop\PM-PROJEKT-ELZA-BLINI`.

## Pre-implementation audit

- Complete: original brand, global shell, Light/Dark/System preferences, strict Trip types, preference collection, shared create/edit form, review, validation, update persistence, and unsaved-change guards.
- Partial: the standalone Overview displayed real data but had no shared contextual workspace.
- Broken: validating the storage array as a whole let one damaged record block every healthy trip. Browser storage denial could throw when constructing the default adapter.
- Missing: trip-specific layout/navigation, nested workspace route infrastructure, route-ID validation, explicit workspace load/retry states, and shared active Trip context.

## Existing code reused

Reused `AppShell`, `BrandMark`/`BrandLockup`, theme providers/tokens, `Trip`, `TripPreferences`, `TripRepository`, `LocalStorageTripRepository`, `TripsProvider`, `TripPlannerForm`, Zod schemas, `TripDetails`, date/budget/status utilities, and existing button/dialog/error primitives. The project and dependencies were retained. Prompt 02's existing uncommitted changes were preserved.

## Workspace architecture and routing

`/trips/:tripId` now mounts `TripWorkspaceLayout`. Its index child renders Overview; its `edit` child reuses the existing planner. Routes are defined once in `src/app/routes.tsx` and reused by browser routing and integration tests.

The layout validates the opaque ID, calls the repository through `TripsProvider.loadTrip`, and derives the active record from the existing trips collection. Concurrent reads for the same ID are deduplicated. Local request state contains status, request identity, and errors only. Nested Outlet context supplies the same Trip to child pages; no independently persisted workspace record exists. Navigation between Overview and Edit retains the parent and does not reread the trip. Late requests cannot display a previously selected trip.

Invalid and missing IDs show a Trip Not Found state with Back to My Trips. Storage/corrupted-record failures show a different error state with Retry. Loading uses status, polite announcements, and `aria-busy`. No fallback state creates data.

## Contextual sidebar

Desktop uses a 248px secondary sidebar with destination, saved date range, origin, and an active Overview link. It uses hover/focus/active styling, wraps long destinations, and supports title tooltips. Only Overview is exposed; future modules are documented rather than presented as dead controls.

Contextual navigation exists only under a valid loaded trip route. Home, My Trips, and Plan a Trip retain global navigation alone. Future modules should become nested child routes and consume `useWorkspaceTrip` while sharing this layout/header/sidebar.

## Overview and design

The compact header displays the saved title, origin/destination, dates, traveler count, date-derived status, and Edit Trip action. Breadcrumbs provide an explicit way back to My Trips.

Divided sections display:

- Trip essentials: origin, destination, traveler count, departure, return.
- Schedule: inclusive calendar days and accommodation nights using existing date arithmetic.
- Budget: the real total amount and saved currency for the whole party.
- Preferences: accommodation, local transportation, interests, pace with a short explanation, and notes only when present.
- Save metadata: browser-local persistence and actual last-update date.

Older trips without preferences show Not Specified and remain editable. No reservations, profiles, spend/remaining calculations, recommendations, or provider metadata are invented. The design uses aligned labels, restrained headings, dividers, and existing semantic tokens. A shared text-on-accent token fixes contrast on primary actions in Dark Theme.

## Editing and consistency

`EditTripPage` is an integration wrapper around the same `TripPlannerForm`, validation, review, and update flow from Prompt 02. Saved edits preserve ID and `createdAt`, update `updatedAt` only for meaningful changes, and return to the same workspace URL. Header, sidebar, Overview, and My Trips derive from the same provider and update together. Save errors remain in the form, and existing unsaved-change warnings cover Cancel, contextual/global navigation, browser history, and reload.

Unmanaged top-level fields and nested budget/preference metadata are preserved in storage when the planner updates its owned fields. Damaged records and conflicting duplicate IDs are isolated from usable records and reported through read diagnostics. Raw damaged data survives creation, update, and deletion of healthy trips; an invalid storage envelope still blocks writes.

## Theme and responsive verification

Actual browser verification used the project's existing Vite server at `http://127.0.0.1:5174/`.

- Desktop: existing 68px rail, 248px contextual sidebar, flexible workspace.
- Tablet (768px): global rail remains; contextual navigation expands/collapses above the content.
- Mobile (390px): existing brand/header/bottom navigation, compact trip identity/header, expandable context navigation, stacked data sections and planner.
- Light and Dark: header, sidebar, controls, preference copy, dividers, review/edit content, and readable primary-action text inspected.
- Keyboard: Enter toggles contextual navigation; navigation from a dirty edit opens the existing discard dialog and Cancel preserves changes.
- Long title: a real form-edited long destination was checked for wrapping/truncation with no horizontal overflow, then restored.

Browser acceptance flow created Prishtina–Rome with two travelers, six days/five nights, EUR 1,500, Hotel, History/Food, and Balanced pace. Editing to Apartment, refreshing, and reopening preserved the same ID and preferences. A separately created Vienna–Graz same-day trip showed one traveler and zero nights and remained independent. Test data was entered only for verification, with no production seed code. Missing and invalid IDs showed recovery states. Final browser logs had no errors or warnings. Deferred-loading, corrupted-record, and storage-denial states were verified through integration/repository tests rather than artificial application delays.

Screenshots: `docs/verification/prompt-03-workspace-desktop.jpg` and `docs/verification/prompt-03-workspace-mobile.jpg`.

## Files added in this phase

- `src/app/routes.tsx`
- `src/features/trips/components/TripWorkspaceLayout.tsx`
- `src/features/trips/components/TripWorkspaceHeader.tsx`
- `src/features/trips/components/TripContextSidebar.tsx`
- `src/features/trips/components/TripWorkspace.module.css`
- `src/features/trips/components/TripWorkspace.test.tsx`
- `src/features/trips/pages/EditTripPage.tsx`
- `src/features/trips/validation/tripId.ts`
- `docs/PROMPT_03_REPORT.md`
- `docs/verification/prompt-03-workspace-desktop.jpg`
- `docs/verification/prompt-03-workspace-mobile.jpg`

## Files modified in this phase

- `src/app/App.tsx`
- `src/app/providers/TripsProvider.tsx`
- `src/features/trips/pages/PlanTripPage.tsx`
- `src/features/trips/pages/TripOverviewPage.tsx`
- `src/features/trips/pages/TripOverviewPage.module.css`
- `src/features/trips/pages/TripsPage.tsx`
- `src/features/trips/pages/Page.module.css`
- `src/features/trips/components/TripDetails.tsx`
- `src/features/trips/utils/tripFormatters.ts`
- `src/features/trips/services/TripRepository.ts`
- `src/features/trips/services/LocalStorageTripRepository.ts`
- `src/features/trips/services/LocalStorageTripRepository.test.ts`
- `src/features/trips/validation/tripSchema.ts`
- `src/styles/global.css`
- `src/components/ui/Button.module.css`
- `DESIGN_RULES.md`
- `README.md`
- `docs/PRODUCT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_NOTES.md`

## Checks executed

- `npm test`: passed, 5 files and 51 tests.
- `npm run lint`: passed, zero warnings/errors.
- `npm run build`: passed, strict TypeScript and Vite production build.
- `git diff --check`: passed.
- Reused the actual running server started with `npm run dev -- --host 127.0.0.1`, which printed `http://127.0.0.1:5174/`.

Tests cover correct/invalid/missing IDs, loading/error recovery, real field and budget display, days/nights, singular travelers, preferences/notes, legacy records, context visibility, global navigation, late-read isolation, editing, identity/creation timestamp preservation, persistence after reload, damaged records, duplicate IDs, and unmanaged field preservation.

## Remaining limitations

Persistence is per-browser localStorage. There is no automatic cloud or cross-tab synchronization, backup, or built-in repair tool for damaged records. Future itinerary, places, maps, accommodation search, transportation routing, expenses, flights, AI, booking, and payments remain unimplemented. This phase was verified locally; the existing hosted deployment was not changed.
