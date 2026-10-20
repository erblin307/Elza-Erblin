# Itinerary engine — implemented contract

## Inputs and boundaries

The current saved Trip supplies destination, inclusive calendar dates, party size, currency, total budget, interests, pace, transport and accommodation preferences. Accommodation and transport are retained in the context and stale fingerprint, but do not manufacture hotel locations or route constraints. Origin is not used as a route model because arrival/departure data is unavailable. Title and free-text notes do not influence scoring.

An `ActivityCandidateProvider` returns candidate inputs, a live/demo mode, and source label. Zod validates stable IDs, names, categories, coordinates, positive durations, nonnegative supported-currency prices, units, ratings, source metadata and date-specific opening windows. Malformed inputs are rejected individually; conflicting duplicate IDs are all rejected. Destination labels are NFC/whitespace/case normalized, not geocoded. Fixture inputs are prohibited in live generation.

## Scoring

All weights are centralized and configurable through generation options. Internal numeric scores are ranking values, not confidence percentages.

| Factor | Weight | Actual contribution |
| --- | ---: | --- |
| Interests | 60 | Matching selected categories / candidate categories |
| Diversity | 16 | Not-yet-covered relevant categories / relevant categories |
| Budget | 10 | `1 - partyCost / allowance`, if comparable and within allowance; zero-allowance free input gets full contribution |
| Duration | 6 | `max(0, 1 - knownMinutes / 480)` |
| Quality | 5 | Provider rating / 5, only for provider-sourced rating evidence |

With selected interests, automatic candidates must match at least one. Without interests, no preference points are invented and all candidate categories can contribute diversity. Missing cost/duration/rating contributes no evidence for that factor; it is not displayed as a bad rating or a free price. Ranking sorts descending score, then ascending stable ID using lexical comparison. Selected categories update coverage before reranking. Explanations are derived from actual factors.

## Distribution and scheduling

Generate exact date-only days, inclusive, supporting up to 366 days. Up to six round-robin passes give each day an opportunity before extra activities are added. Each turn tries highest-ranked feasible remaining candidates. Accepted IDs are removed globally. No randomization or duplicate visits; sparse data leaves partially filled or empty days.

| Interior-day pace | Maximum activities | Activity minutes | Planning window |
| --- | ---: | ---: | --- |
| Relaxed | 3 | 240 | 09:00–16:00 |
| Balanced | 4 | 360 | 09:00–17:00 |
| Active | 6 | 480 | 09:00–19:00 |

First/last days, including one-day trips, are provisional: maximum two activities, 180 activity minutes, 10:00–16:00. These are planning assumptions, not inferred arrival times. Known durations are used; missing durations use the stored 60-minute assumption and are labeled. The scheduler reserves 12:30–13:30 for lunch/free time and 30-minute unallocated inter-activity buffers. Supplied date-specific opening windows constrain activities; absent windows are explicitly unverified. Gaps are not restaurant reservations or measured travel durations. Candidate count, total duration and time windows must all fit; no quota is forced.

The core engine receives `generatedAt` from its service caller. Equal trip, candidate/configuration and timestamp inputs produce equal structured output, independent of input order. Generation does not use storage, a clock, network, or React.

## Costs and allowance

Default activity allowance is 20% of total trip budget, rounded down to cents. The user may configure it between zero and the total budget. It is an itinerary-generation constraint, not the Budget ledger. Comparable known totals are a hard selection and editing cap.

Per-person inputs multiply by travelers; group inputs count once; entry inputs multiply only by explicitly supplied entry quantity. Missing entry quantity, missing prices and mismatched currency remain unknown/non-comparable. No exchange rate is invented. Explicit source zero is different from missing data. Day/trip totals are derived from catalog references and report unknown counts, never claiming complete budget feasibility.

## Data policy

Configured live mode uses `GeoapifyCandidateProvider`: it requires an explicitly confirmed Geoapify Trip destination and retrieves up to 30 candidates within 5 km using centralized interest/category translation. Normalized real candidates enter the unchanged pure ranking/scheduling engine. Without credentials the unavailable adapter remains honest; fixtures are never substituted. Explicit demo mode dynamically loads isolated stable-ID Rome/Vienna fixtures: generic synthetic exercises, not named real attractions. Sample prices remain labeled estimates, not actual ticket prices. Unsupported destinations are not fabricated.

Prompt 05 adds a separate optional geographic-demonstration adapter: the same generic pool plus source-checked static landmark coordinates. The original demo mode and old saved artifacts remain unchanged. Landmark price, duration, hours and availability are not invented. This is not live Places discovery; see `MAP_INTEGRATION.md` for coordinate provenance and map behavior.

## Editing, integrity and persistence

Remove an occurrence, reorder up/down, move to an existing day, or add an unscheduled saved-catalog candidate. Each operation rebuilds timings and validates capacity, budget and duplicates before saving. Removed candidates remain in the catalog. IDs remain stable; derived totals update. Regeneration requires confirmation and failed generation/save preserves the previous plan. Duplicate submissions are synchronously guarded.

The existing TripRepository saves an optional structured itinerary within the same Trip record. Catalog metadata is not duplicated into items. Writes verify trip ownership, current context fingerprint and itinerary schema. Invalid artifacts do not hide healthy Trip cores and are not silently rewritten. Relevant trip changes preserve manual work but show a stale warning and disable editing until explicit regeneration. Independent trip IDs isolate plans; browser reload reads actual localStorage.

## Limitations and next integrations

This is a greedy planning heuristic, not a global optimizer, booking service or LLM. Places retrieval, conditional licensed imagery, explicit local-route calculation and a separate Budget projection are implemented, with live Geoapify verification awaiting credentials. The Budget consumes these comparable source costs but does not alter the generator. There is no availability, flight/intercity search or FX conversion. There is no direct time editing, locked activities, repeated visits or single-day regeneration. The generator's generic 30-minute buffers remain planning assumptions; they are not replaced by route results or treated as guaranteed geographic feasibility.

The map uses catalog candidate/provider IDs, optional coordinates and item day/order. Places additions reuse `editItinerary`, validate ownership/day/current context, preserve source identity and coordinates, and prevent repeated provider entities. An empty artifact is initialized through the existing generator with no invented candidates. The catalog stores optional place/media metadata once; map markers remain derived. A confirmed destination ID enters the context fingerprint; old plans stay preserved but stale until explicit regeneration. Mixed fixtures/provider records are disclosed.

Transport transitions are a separate derivation: each current adjacent pair, plus optional selected-stay endpoints, has a stable segment identity. A successful provider route supplies the transition's mode, duration and distance. Conflict detection compares the previous activity's scheduled end plus provider duration with the next activity's scheduled start; missing timing or a missing/currently unavailable route yields unknown, never “conflict-free.” Reorder, move, add/remove, stay replacement/removal and mode changes alter identities or route keys, so old results are not displayed. Travel blocks are not itinerary activities and are not persisted. See `TRANSPORTATION_AND_ROUTING.md`.

Prompt 11 adds only boundary-day constraints. A current outbound arrival on the Trip start date raises that day's scheduling start; a current return departure on the Trip end date lowers that day's end. These local clock values are planning bounds, not elapsed flight calculations. Existing itineraries are never regenerated or edited automatically: conflicts are surfaced for review, relevant journey/context changes make the saved itinerary stale, and manual edits remain intact. Missing arrival/departure times, timezone evidence and airport/station/hotel transfer durations stay explicit uncertainties. See `FLIGHTS_AND_LONG_DISTANCE_TRANSPORT.md`.
