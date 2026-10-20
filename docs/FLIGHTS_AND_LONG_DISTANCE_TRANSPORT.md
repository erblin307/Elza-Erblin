# Flights and long-distance transportation

## 1. Provider selection

Duffel is the single preferred flight provider. The application remains provider-independent through `FlightSearchProvider`; no second commercial adapter is introduced.

## 2. Credentials and configuration

The frontend never accepts a Duffel token in a `VITE_` variable. `VITE_FLIGHT_SEARCH_ENDPOINT` is the public URL of an authorized secured server/edge adapter. That server owns `DUFFEL_ACCESS_TOKEN`, calls Duffel and returns normalized contracts. No endpoint or credential was available during Prompt 11.

## 3. Test versus live data

Every offer carries `environment: test | live`. The UI labels provider sandbox results and live provider results separately. The development QA page contains visibly labeled synthetic *manual* travel only and is excluded from production; production never falls back to fixtures.

## 4. Airport resolution

Search starts from Trip city labels but requires explicit selection returned by the configured endpoint. Airport records require provider ID, name and a validated uppercase IATA code, with optional city, timezone and coordinates. The Trip city is never overwritten and no code is inferred.

## 5. Flight offer model

`FlightOffer` contains provider/environment, outbound and optional return journeys, optional total-party price, optional baggage, expiry/retrieval timestamps and source reference. Missing facts stay absent.

## 6. One-way and round-trip handling

The form supports both modes and independent outbound/return dates. A round-trip selection produces linked outbound and return records under one offer group. Its total cost exists once; no invented split is created.

## 7. Segments and connections

A journey contains one or more segments and an explicit connection count. Segments can retain carriers, flight number, airport events, duration and aircraft when supplied. Connection airports come from adjacent segments. Layovers are calculated only when both adjoining absolute instants exist and are ordered; otherwise the UI says duration is unavailable.

## 8. Timezone handling

Every event keeps local date/time plus optional timezone, UTC offset and absolute instant. Absolute comparisons use instants/offsets only. Unknown-zone manual times are preserved exactly and never parsed through the browser timezone. Provider duration remains authoritative when present, including overnight journeys.

## 9. Price provenance

Provider totals are `provider_offer` and total-party scoped. Manual amounts are `user_estimate`. Currency and cost identity are explicit. The app does not multiply totals, infer fees or missing prices, or call a limited result set universally cheapest.

## 10. Offer expiration

`expiresAt` is retained. Expired offers cannot be selected and expired selected quote values are excluded from current Budget totals. Refresh is user-initiated; an expired selection is never silently replaced.

## 11. Planned versus booked

All records have status `planned`. Selection is not ticketing, payment, reservation or check-in confirmation.

## 12. Manual long-distance transport

Flight, train, intercity bus, long-distance car and other modes work without a provider. The form captures direction, locations, departure, optional arrival, optional offsets, operator/service/reference, user estimate and notes. No passport, identity or payment-card data is requested.

## 13. Persistence

The optional version-1 artifact belongs to the canonical Trip and is saved through `TripRepository.saveLongDistanceTravel`. Ownership, IDs, schema and optimistic revision are validated. Malformed artifacts are isolated/preserved. CRUD survives reload and remains Trip-isolated. Duplication uses fresh identities and excludes expired provider selections.

## 14. Itinerary constraints

A current outbound arrival on the first date becomes the earliest activity start. A current return departure on the last date becomes the latest activity end. Existing plans are not rewritten: conflicts and uncertainty are displayed, and changed travel context makes a plan stale until explicit regeneration.

## 15. Budget reconciliation

The existing Budget engine derives Transportation rows. Current, unexpired, current-context amounts in Trip currency count; one round-trip identity counts once. Unknown, foreign, expired or stale values produce incomplete coverage. An explicitly reconciled real manual expense suppresses its estimate without deleting payment or changing booking status.

## 16. Security and privacy

The browser sends only airport queries/search inputs to the configured endpoint. It stores no secret and collects only passenger counts needed for search. Requests are user-triggered, cancellable, deduplicated, timed out and locally rate-bounded; authorization, rate-limit, network and malformed-data failures are distinct. Sensitive identity/payment data and console logging are absent.

## 17. Provider limitations

The normalized endpoint is implemented but not deployed here. No credential was present, so neither Duffel test mode nor live inventory was called. Train/bus operators and schedules have no provider integration. Airport-to-hotel transfer time/cost is not inferred. The map does not draw fake international routes.

## 18. Test coverage

Tests cover normalization, one-way/round-trip/multi-segment data, environment, price/baggage/expiry, missing/error states, reliable/unknown layovers, timezone/overnight behavior, manual validation, persistence/isolation/duplication, Budget deduplication/expiry/reconciliation, boundary generation, conflict preservation and route UI flows.

## 19. Local setup

Run `npm install` and `npm run dev`. Manual planning works immediately. To enable search, deploy an authorized adapter implementing `POST {endpoint}/airports` and `POST {endpoint}/offers`, keep the token there, set `VITE_FLIGHT_SEARCH_ENDPOINT`, then restart Vite. Never create `VITE_DUFFEL_ACCESS_TOKEN`.

## 20. Known limitations

No live/test provider access was verified. Offers cannot be booked or refreshed automatically. Multi-city, seats, fare rules, live status, gates, passports, payments, train/bus inventory, FX conversion and transfer routing are outside Prompt 11. User-entered details/prices remain unverified.

Official references: [making requests](https://duffel.com/docs/api/overview/making-requests), [offer requests](https://duffel.com/docs/api/v2/offer-requests), [offers and expiry](https://duffel.com/docs/api/v2/offers), [test mode](https://duffel.com/docs/api/overview/test-mode), [errors and limits](https://duffel.com/docs/api/overview/response-handling), and [frontend-token security](https://help.duffel.com/hc/en-gb/articles/4504698704530-Can-I-use-the-Duffel-API-directly-from-my-frontend-application-or-mobile-app).
