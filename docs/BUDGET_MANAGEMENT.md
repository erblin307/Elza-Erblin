# Budget management and cost intelligence

## Scope

Prompt 09 adds a Budget workspace for each saved Trip. It combines two sources without duplicating ownership:

- itinerary-linked activity estimates are derived from the current saved itinerary and its catalog;
- traveler-entered expenses are stored in one normalized, versioned ledger on the Trip.

The projection reports what is known and comparable. It does not treat missing prices as zero, call an AI model, perform currency conversion, infer transport fares, or turn a selected stay into an accommodation price.

## Route and navigation

The page is lazy-loaded at `/trips/:tripId/budget` inside the existing Trip Workspace. Budget appears in the contextual navigation and breadcrumb. The Overview uses the same pure projection for a compact known-cost and remaining/over-budget summary; it does not maintain separate totals.

## Manual expense model

`Trip.budgetLedger` is optional for backward compatibility and has schema version `1`. A ledger contains at most 500 manual expenses. Every expense has:

- stable ID and owning Trip ID;
- title and nonnegative finite amount;
- the currency in which the traveler entered it;
- one category: Accommodation, Transportation, Activities, Food, Shopping or Other;
- certainty of Confirmed or Estimated;
- optional ISO calendar date and optional plain-text note;
- `source: manual` plus creation and update timestamps.

Duplicate IDs, cross-Trip ownership, invalid dates, unsupported currencies, excessive lengths and malformed numeric values are rejected. Add, edit and delete actions replace the complete validated ledger through `TripRepository.saveBudgetLedger`; page components never write browser storage directly. Delete requires confirmation. A failed save leaves the previously loaded Trip intact.

## Linked itinerary costs

Activity rows remain read-only projections. Each saved itinerary occurrence resolves its catalog candidate and applies the existing `activityCost` semantics:

- per-person price × current traveler count;
- per-group price once;
- per-entry price × explicit entry quantity only;
- source zero is a known zero;
- missing price, missing entry quantity or another currency remains unknown/non-comparable.

Comparable occurrences become Estimated Activities expenses linked by itinerary item ID and day date. They are never copied into the manual ledger, so itinerary edits, traveler changes and current source data flow into the next Budget calculation without stale duplicate expenses.

If the saved itinerary no longer matches the Trip destination, dates or confirmed destination identity, its linked activity rows are excluded from totals and coverage is labeled outdated. Traveler and total-budget changes alone do not invalidate the schedule: per-person estimates recalculate against the current traveler count.

## Arithmetic and summaries

The engine rounds each comparable amount to integer cents before summing. Only the Trip's current currency contributes to the total. If a Trip currency changes, an older manual amount remains preserved and visible but does not enter totals until the traveler explicitly edits it; the system has no exchange-rate source.

The projection returns:

- total budget, known cost, remaining amount and over-budget amount;
- Comfortable below 80%, Close at 80–100%, or Over budget above 100%;
- confirmed and estimated cost split;
- totals for all six categories, including explicit zero categories;
- one total for every inclusive Trip calendar day, plus an undated-expense count;
- coverage state for accommodation, activities and transportation;
- deterministic insight sentences for remaining/over amount, largest known category, most expensive dated day and incomplete coverage.

Status is based on known comparable costs only. Whenever source costs are unknown or non-comparable, the page labels the result an incomplete estimate.

## Accommodation and transport boundaries

The selected-stay boundary currently returns `unknown`; there is no verified rate, mandatory-charge or availability offer. The Budget therefore shows selected accommodation as unknown rather than a zero-valued expense.

Local routing supplies mode, geometry, distance and estimated duration, but no fare, ticket, fuel, parking or toll price. The Budget shows transportation pricing as unavailable when transport planning exists. Travelers may record an explicit manual Accommodation or Transportation expense, but that entry remains user-confirmed or user-estimated and is not attributed to a provider.

## Persistence and recovery

The existing version-1 Trip storage envelope is unchanged. Optional ledgers are parsed independently from the core Trip. A malformed ledger produces a Trip-specific warning and is omitted from the working projection, while its original raw value is preserved during unrelated Trip writes. Only an explicit successful Budget save replaces it. Existing trips without a ledger load as an empty ledger.

All data remains in browser localStorage with the rest of the Trip. Budget calculation, manual entry and insights make no network request and transmit no financial data. Trip duplication copies only manual expenses marked Estimated, gives them fresh IDs and continues to derive itinerary-linked rows instead of copying them. Confirmed spending history is omitted from a copy. Clearing browser storage removes the ledger; there is no account, cloud backup, collaboration or multi-device synchronization. The My Trips JSON export is manual and local; import is not implemented.

## Verification harness

`dev/budget-qa.html` is a development-only page with visibly labeled synthetic activity estimates and an isolated sessionStorage repository. It exercises the production Budget route, calculation and edit UI without touching the production Trip key. The harness is not reachable from the production application and its label is checked out of the production bundle.

## Limitations

## Long-distance travel costs and reconciliation

Current planned journeys may produce read-only Transportation expenses. A provider total retains `provider_offer` provenance and total-party scope; a manual amount retains `user_estimate` provenance. One shared identity represents a round-trip offer, so its total is included once and never split or multiplied by travelers. Separate one-way costs remain independent. Only current, unexpired, unreconciled amounts in the Trip currency enter totals; outdated/expired/foreign/unknown costs increase incomplete coverage.

If a traveler records an actual payment in the existing manual ledger and explicitly links it through `reconciledExpenseId`, the planned estimate is suppressed while the real expense remains. Offer expiry or journey removal never deletes actual spending and never marks a journey booked.

The Budget system does not include receipt scanning, automatic categorization, recurring expenses, payer/split settlement, refund modeling, foreign-exchange conversion, price alerts, booking or AI-generated advice. It does not backfill manual expenses from route distance or selected accommodation. Provider offer pricing is supported only through a configured secured endpoint; none was available for live verification in Prompt 11.
