# Prompt 04 — implementation report

## Audit and reuse

COMPLETE and reused: Prompt 01 shell, Route Frame branding, semantic Light/Dark tokens, shared controls; Prompt 02 Trip/preference models, planner, Zod validation, calendar utilities and repository; Prompt 03 nested workspace, same-trip Outlet context, header and contextual navigation. PARTIAL: future itinerary/provider concepts existed only as architecture notes. MISSING before this phase: normalized candidates, ranking/scheduling, structured artifact, editable timeline and stale detection. No working module required replacement; existing earlier-phase changes were preserved. No second app shell, store, repository or fake default Trip was introduced.

## Recommendation engine and scoring

Pure validated deterministic greedy selection with round-robin day distribution and stable-ID ties. Scores are interest 60, uncovered relevant-category diversity 16, known comparable budget suitability 10, known duration suitability 6, and provider-rating evidence 5. Weights are configurable; missing factors add no fabricated evidence. Selected interests filter automatic candidates, diversity encourages variety within those interests, and selected candidate IDs are removed globally. See `ITINERARY_ENGINE.md` for exact formulas.

## Scheduling

Inclusive calendar dates, duration-aware pace constraints, 30-minute unallocated buffers, a generic lunch interval, supplied date-specific opening windows and conservative provisional first/last days. Unknown duration uses an explicitly labeled 60-minute assumption. Sparse pools leave days partially filled or empty. Scheduling and validation do not claim real routing, confirmed bookings or arrival times.

## Candidate data

Development fixtures only in explicitly selected demonstration mode. The isolated dynamically loaded Rome/Vienna adapter supplies stable synthetic planning examples, not live named attractions. Synthetic person/group/entry/free cost inputs are clearly labeled; other prices remain unknown. No coordinates, opening hours or reviews were invented. The default live adapter reports insufficient data. A provider interface separates retrieval from normalization and ranking.

## Itinerary UI and editing

Functional `/trips/:tripId/itinerary` in the existing workspace. Editorial timeline, ordered activity labels, suggested times, real calendar headings, daily known-cost/unknown-count summaries, scrollable day navigation, source disclosure, and native accessible details/confirmation dialogs. Controls remove an occurrence, reorder up/down, move between existing days, and add an unscheduled catalog candidate. Changes rebuild valid schedules and persist; invalid capacity/budget moves leave the old plan intact. Regeneration asks before replacing saved work and failed retrieval/write preserves it. Pending operations prevent duplicate requests.

## Persistence and integrity

Optional `Trip.itinerary` inside the existing version-1 localStorage envelope, saved through TripRepository/TripsProvider. Catalog metadata is stored once; items reference IDs. Saves verify ownership/current fingerprint, all trip days, references, uniqueness, timings and known-cost cap. Malformed/conflicting candidate records are filtered independently. Damaged itinerary data is diagnosed separately from a healthy Trip core and preserved until explicit replacement. Relevant Trip preference changes flag stale plans without discarding manual work. Independent Rome/Vienna plans were verified in repository and route-level tests.

## Budget awareness

Configurable activity allowance defaults to 20% of the total budget, not all travel spending. Person × travelers; group once; entry × explicit entry count. Missing prices and currency mismatches remain unknown, with no invented exchange rates. Known comparable cost is capped; complete trip affordability is never claimed. The browser acceptance Rome trip (two travelers, EUR 1,500, June 12–17, 2027, balanced History/Architecture/Food) generated six days and EUR 60 known synthetic party costs: EUR 24 person + EUR 20 group + EUR 16 entry, with nine unknown/non-comparable costs.

## Verification

- `npm test -- --run` and final `npm test`: **106 passed, 8 test files**. Includes 42 engine cases, 5 itinerary persistence cases and 8 itinerary route interaction cases, alongside 51 existing tests.
- `npm run lint`: passed, exit 0.
- `npm run build`: passed, including strict TypeScript checking through `tsc -b`, exit 0. Main JS 478.79 kB; isolated fixture chunk 3.58 kB.
- Local browser: actual Rome workspace, honest live no-data state, explicit demo generation, six calendar-day navigation, unknown information in details, reorder, cross-day move, reload persistence, and regeneration confirmation/cancel verified.
- Reorder moved the history exercise after the historic walk; moving that exercise to Day 5 persisted after reload and displayed three activities on the destination day.
- Removal, catalog addition, invalid moves, provider failure, duplicate generation, stale detection after real Edit workflow, corrupt artifacts, write failures and independent second-trip generation covered by automated tests. Removal was not repeated manually in the browser.
- Desktop Light/Dark, 768px tablet and 390px mobile visually inspected. Mobile action controls stack and day selector scrolls. Document width equaled viewport width (390 and 768), with no page horizontal overflow. Browser warning/error logs were empty.
- Loading/pending and failures are exercised by deferred/rejected-service UI tests; no artificial delay was added for visual testing.

Screenshots in `docs/verification/`: `prompt04-desktop-light.jpg`, `prompt04-desktop-dark.jpg`, `prompt04-mobile-light.jpg`, `prompt04-mobile-dark.jpg`, `prompt04-tablet-light.jpg`. Full-page captures can show the fixed mobile navigation at its viewport position; this is not a repeated content block.

## Files added in this phase

- `src/features/itinerary/types/itinerary.ts`
- `src/features/itinerary/domain/context.ts`
- `src/features/itinerary/domain/costs.ts`
- `src/features/itinerary/domain/scheduling.ts`
- `src/features/itinerary/domain/validation.ts`
- `src/features/itinerary/domain/scoring.ts`
- `src/features/itinerary/domain/generator.ts`
- `src/features/itinerary/domain/editing.ts`
- `src/features/itinerary/services/ActivityCandidateProvider.ts`
- `src/features/itinerary/services/itineraryGenerator.ts`
- `src/features/itinerary/fixtures/FixtureActivityProvider.ts`
- `src/features/itinerary/components/ActivityDetailsDialog.tsx`
- `src/features/itinerary/components/ItineraryTimeline.tsx`
- `src/features/itinerary/components/Itinerary.module.css`
- `src/features/itinerary/pages/ItineraryPage.tsx`
- `src/features/itinerary/tests/testData.ts`
- `src/features/itinerary/tests/engine.test.ts`
- `src/features/itinerary/tests/persistence.test.ts`
- `src/features/itinerary/tests/ItineraryPage.test.tsx`
- `docs/ITINERARY_ENGINE.md`
- `docs/PROMPT_04_REPORT.md`
- Five verification screenshots listed above.

## Files modified in this phase

- `src/app/routes.tsx`
- `src/app/providers/TripsProvider.tsx`
- `src/features/trips/types/trip.ts`
- `src/features/trips/services/TripRepository.ts`
- `src/features/trips/services/LocalStorageTripRepository.ts`
- `src/features/trips/components/TripContextSidebar.tsx`
- `src/features/trips/components/TripWorkspaceHeader.tsx`
- `README.md`
- `docs/PRODUCT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_NOTES.md`

This inventory is phase-specific; the worktree also contains retained uncommitted Prompt 02–03 work. No unrelated edits were reverted or committed.

## Local URL and scope

Actual development URL: http://127.0.0.1:5174/ (Vite used 5174 because 5173 was already occupied). Changes are local; the existing hosted Site was not republished. The Sites skill guided local preview and source/provider isolation while retaining the existing application.

## Known limitations and next phase

No live Places provider, geocoding, real routes, availability, booking, exchange rates, images, complete travel-budget engine or LLM. Greedy ranking is not global optimization; buffers do not guarantee real travel feasibility. Destination matching currently uses normalized exact labels. Generation supports at most 366 days. Direct time editing, repeated visits, locked activities and single-day regeneration are not implemented.

Ready for **Prompt 05 — Interactive Map & Itinerary Synchronization**: candidate/provider IDs, optional coordinates and day/order are structured for map consumption. Real Places discovery belongs to Prompt 06. Work stops here without implementing those integrations.
