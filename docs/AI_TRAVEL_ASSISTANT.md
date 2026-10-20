# Trip assistant — Prompt 12

## 1. Architecture

`/trips/:tripId/assistant` uses the existing workspace and `TripsProvider`. One
`AssistantOrchestrator` per repository lifetime owns request locks, ephemeral
history and proposals. The page only renders responses and submits commands.
The repository remains the authoritative Trip store.

## 2. Deterministic versus LLM capabilities

The working assistant is explicitly labelled **Local · deterministic**. Anchored
English command patterns dispatch grounded reads and bounded proposals. It does
not understand arbitrary free-form language. Unsupported requests receive a
clarification and the `help` command lists supported syntax.

## 3. Provider configuration

No LLM credentials or secure backend were available. No external language API is
connected or called. `AssistantLanguageProvider` and `interpretSafely` are a
validated extension seam, not a deployed integration. They are not wired into
the local command flow. A future server integration must add authentication,
authorization, rate limits and credential management before enabling it.
Alternative discovery and routing reuse existing Geoapify configuration;
unconfigured services return an explicit limitation. Do not put private language
provider secrets in Vite environment variables.

## 4. Security and secret handling

No arbitrary tool lookup, code execution, HTML rendering or model-driven repository
access exists. React renders provider names and user text as text. Strict Zod
schemas reject extra action fields. The approach follows least-agency guidance
described in [OWASP prompt injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
and [excessive agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/).
These safeguards are not a security audit or a multi-user authorization system.

## 5. Trip context construction

Each request reloads the selected ID through `TripRepository.get`. Context
projects only the active Trip and requested topic: summary, itinerary/day,
budget, accommodation, transport, journeys or conflicts.

## 6. Context minimization

Projections omit notes, booking references, raw provider envelopes, unrelated
Trips and historical messages. No full storage dump is assembled. Context is
not sent to an LLM in the current implementation.

## 7. Supported intents

- `Summarize my trip`
- `Review my budget` / `What is my remaining budget?`
- `Summarize itinerary` / `What is planned for Day 2?`
- `List unknown costs`
- `Which hotel did I choose?`
- `When do I arrive?` / `Summarize flights`
- `Summarize transport`
- `Identify schedule conflicts`
- `Make Day 2 more relaxed` / `Make Day 2 cheaper`
- `Find alternative places` / `Find alternatives for "exact activity name"`
- `Reduce walking on Day 2`
- `move "exact activity name" to day 2`
- `remove "exact activity name"`
- `reorder "exact activity name" up` (or `down`)
- `set pace relaxed` (or `balanced`, `active`)

Names are exact, case-insensitive matches. Ambiguous names ask for the item ID.
Day references must exist. Commands do not regenerate an entire itinerary.

## 8. Allowed action registry

The strict discriminated action union allowlists `remove_activity`,
`move_activity`, `reorder_activity`, `replace_activity`, `update_travel_pace`
and `set_segment_mode`. No delete-Trip, reservation, payment, expense-edit,
arbitrary URL fetch, date-edit or accommodation mutation is exposed.

## 9. Structured validation

`previewAction` validates the allowlist and checks current itinerary ownership,
staleness, item references, candidate identity and destination/day constraints.
The existing itinerary editor and discovered-place adapter validate scheduling
and duplicate places. Optional language output must parse as a strict
interpretation and match the active Trip ID.

## 10. Preview and confirmation

Proposals show the affected Trip, before/after schedules or preferences, the
existing Budget engine's forecast difference and important unknowns. Preview
does not write. Cancel only changes ephemeral proposal state. Apply reloads,
revalidates and writes through the existing repository with expected revision.
Success is shown only after persistence succeeds. Published Trip state updates
the workspace. Presentation objects cannot rewrite the stored action.

## 11. Stale proposals and request bounds

Proposals expire after 15 minutes and require the same `updatedAt` revision.
A new proposal cancels prior pending proposals for that Trip. Apply is guarded
against repeat/concurrent execution. Inputs are capped at 2,000 characters.
Search performs one provider search; route comparison performs two route calls;
no autonomous loops run. Existing provider clients retain their network limits.
The optional language seam has a 15-second timeout and cancellation handling.

## 12. Trip isolation

History and proposals are keyed by Trip ID. Cross-Trip Apply is rejected.
Trip changes remount the conversational view. Repository revisions protect
against intervening saved edits; this is local data scoping, not server auth.

## 13. Itinerary integration

All edits use the established scheduler/editor. Lighter-day suggestions remove
the last automatically chosen activity only when at least two exist; manually
added activities are preserved unless explicitly named by the user. Replacement
uses the existing add-place path and may append within the day; the preview
shows the resulting schedule. There is no new lock model.

## 14. Budget integration

`calculateBudget` supplies all forecasts and remaining amounts. Unknown or
non-comparable prices remain unknown. Cheaper alternatives require a comparable
known price and a feasible schedule. Paid expense records are not erased.
The assistant never directly edits totals or invents currency conversion.

## 15. Places integration

Explicit alternatives search uses the saved resolved destination, current
interests (or the target's categories), a 5 km radius, normalization and existing
recommendation scoring. Up to five candidates are considered. IDs, coordinates
and source labels are preserved. No live result is claimed without a provider.

## 16. Transport integration

Connections are derived from the same itinerary. The walking-reduction command
compares the first eligible walking connection with a provider driving route
and proposes one mode change. It does not guarantee less total journey time or
vehicle access. Fares, parking, accessibility and traffic remain unverified.
The read summary directs users to Transport for current calculations rather
than inventing durations. Changed route endpoints/order invalidate route keys.

## 17. Accommodation and journeys

Reads include selected property, address/dates and review state. Journey answers
retain source/environment, entered arrival times and timezone/offset information.
Missing arrivals are unknown. A planned stay/journey is not a booking. No
purchase, reservation or automatic accommodation/flight change is supported.

## 18. Persistence

History is memory-only: up to 10 Trips, 40 messages per Trip and 50 proposals.
Clear conversation removes that Trip's memory and pending proposals. Refresh
clears all conversation state; confirmed changes remain in the existing
versioned Trip storage. No new persisted Trip fields or migration are introduced.

## 19. Privacy limitations

Browser-local storage is not encrypted or an account boundary. Anyone with
access to the browser profile can inspect saved Trips. Explicit Places/routing
requests send the required destination/category or endpoint data to existing
providers. User chat is not sent to an LLM. Memory history is neither cloud sync
nor a durable audit log.

## 20. Testing and limitations

Tests cover read-only storage invariance, preview/cancel/apply, cross-Trip and
stale rejection, repeat clicks, save failures, schema injection, malformed
language output, timeout, projections, provider seams and cross-module changes.
`dev/assistant-qa.html` is development-only, synthetic and uses a separate
sessionStorage key. It never seeds production Trips. See `PROMPT_12_REPORT.md`
for actual run results and browser checks. Live external provider verification
requires credentials; local tests of providers use explicitly synthetic data.
Free-form multilingual language, global optimization, live bookings, expense
mutations and production server authorization are outside this phase.
