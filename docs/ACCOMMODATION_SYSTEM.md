# Accommodation system

## Scope and architecture

The lazy `/trips/:tripId/accommodation` route belongs to the existing Trip Workspace. It reuses its Trip context, preferences, date arithmetic, semantic theme tokens, controls, repository and navigation. `AccommodationDiscovery` wraps the existing `livePlacesProvider` singleton: no second Geoapify HTTP client, map, image component or Trip store is introduced. Common geographic identity normalization lives in `places/domain/geoEntity.ts`; activities retain their separate scheduling model.

Discovery is not commercial inventory. The UI does not promise room capacity, availability, ratings, amenities, prices or reservations. Dates and traveler count describe the intended stay, not verified room arrangements. A same-day trip has zero nights and cannot select an overnight stay.

## Destination and search

The confirmed destination resolution from Places supplies provider identity and coordinates. If absent or stale, users resolve it through the existing Places flow; accommodation never silently chooses a city. Searches use Geoapify `/v2/places`, proximity bias, a coordinate circle and a maximum of 30 records. Name, type and radius refinements trigger a new search after a 400 ms debounce once searching has started. Radius choices are 2, 5, 10 and 20 km. Additional local coordinate/type validation prevents out-of-area or mismatched results from appearing.

| UI filter | Geoapify category |
| --- | --- |
| All accommodation | `accommodation` |
| Hotels | `accommodation.hotel` |
| Apartments | `accommodation.apartment` |
| Hostels | `accommodation.hostel` |
| Guesthouses | `accommodation.guest_house` |
| Motels | `accommodation.motel` |

Other accommodation subtypes returned by the parent category retain a generic property classification. Source: [Geoapify Places documentation](https://apidocs.geoapify.com/docs/places/). Coverage depends on the provider's underlying geographic data; these are not exhaustive hotel inventories.

The shared RequestClient supplies in-flight deduplication, cancellation, 10-second timeout, 5-minute bounded memory caching (100 entries), request limits and rate-limit backoff. The page discards stale requests on refinement, trip change and unmount. Details are fetched on demand through the existing `/v2/place-details` endpoint, not eagerly for every result. No paid commercial calls occur.

## Property identity and validation

An Accommodation has a stable `geoapify-<providerId>` identifier, provider ID, name, validated latitude/longitude, category-derived types and source metadata. Metadata includes optional address, website, references, retrieval time and conditional licensed image. Unknown fields stay absent. Validation rejects invalid identity/coordinates/names; individual bad records do not invalidate usable neighbors. Duplicate IDs merge compatible category/reference data; conflicting coordinates quarantine that identity. Equal names with different IDs remain distinct properties.

## Recommendation logic

The pure scorer awards 100 points for matching a non-`any` saved accommodation preference and up to 20 points for proximity: `20 × max(0, 1 - distanceKm / radiusKm)`. Distance is haversine straight-line distance from the confirmed search center, not walking/driving distance or a city-center travel time. Stable property ID breaks ties. Results are deduplicated and radius-filtered before display. Reasons explicitly state preference match and straight-line distance. Missing prices, amenities and classification do not penalize quality; no quality, affordability or availability score is invented. Search filters do not overwrite trip preferences.

Users may compare up to three properties by actual type, address and distance. Unverified pricing, availability and amenities are labeled unknown, not displayed as zero or absent facilities.

## Property photography

The existing Wikimedia resolver accepts only an explicit property Wikidata reference and validates nearby Earth coordinates, P18/Commons identity and author/license/source metadata. Accommodation uses a stricter 200 m coordinate tolerance than general attractions. Brand references do not substitute for property identity. TravelImage renders the same attribution and safe source links as Places. No generic city photo, scraped partner image or invented license is used. Missing identity, image, acceptable metadata or load success produces the neutral missing-photo fallback. This conservative process cannot guarantee a photo for every property.

Follow Commons file-specific license/attribution requirements. Geoapify/OpenStreetMap attribution remains visible for geographic data. Selected snapshots retain only the normalized geographic metadata and permitted Commons reference, not commercial inventory. Commercial content would require its provider-specific retention/image/caching rules before implementation.

## Selection and persistence

`Trip.selectedStay` stores one property snapshot, trip ID, destination label, check-in/out, travelers, `selectionStatus: planned` and selection timestamp. The existing versioned localStorage repository owns `saveStay`; no page writes storage directly. Selection checks trip ownership, destination resolution, valid property identity, positive nights and matching current trip context. Replacing asks confirmation and atomically swaps the primary selection. Removing clears only that stay; search results, itinerary and budget remain intact. Failed writes preserve the old selection.

Changing destination, dates or travelers preserves the original snapshot and shows a review notice. Malformed optional stay records are isolated with a warning; their raw content is preserved until explicit replacement/removal. Existing trips without a stay continue to load. Persistence is browser-local, not cloud sync or guaranteed backup.

## Overview and map

Overview displays actual property name/address, stay dates, nights and Planned status, or a compact find action. Both workspaces derive the same saved Trip field. `InteractiveTripMap` adds distinct labeled Stay markers alongside unchanged day/activity markers. List selection focuses its property marker; marker selection updates focused property information. The discovery map shows current results and the selected stay; the Trip map shows the saved stay, not transient search results. Replacing/removing updates derived markers.

Transportation may use the current valid Stay coordinate as an optional first endpoint and optional end-of-day return endpoint. It does not add the property as an itinerary activity or assume a return between attractions. A stale/malformed/removed stay supplies no route anchor; replacing it changes hotel-segment identity while activity-to-activity route keys remain reusable. Provider route results are short-lived memory data, not part of `selectedStay`.

## Costs and optional inventory

`accommodationCost(stay)` returns `status: unknown` with property/date context and a reason. It does not create an expense or subtract from the trip budget. The Budget workspace shows this incomplete coverage and permits an explicit traveler-entered accommodation expense, but it does not attach that manual amount to a provider offer or present it as verified inventory.

`AccommodationInventoryProvider` is an extension interface only. Its request explicitly models property identity, stay dates, room adults/child ages and currency. Offer types preserve provider identity, original request, verification/expiry timestamps, availability and optional authoritative total/mandatory-charge context. There is no installed commercial adapter, offer persistence, booking deep link or rate-check UI. A future implementation must securely map property IDs, validate dates/occupancy/fees/currency, respect provider terms, expire offers, and invalidate them when inputs change before exposing verified costs to Budget. Do not infer final totals from nightly rate × nights.

## Configuration and security

Accommodation uses the existing public `VITE_GEOAPIFY_API_KEY`. Restrict its allowed origins/referrers and quota, set it locally, and restart Vite. `.env.example` contains names only. `VITE_WIKIMEDIA_CONTACT` identifies the application to Wikimedia. Production map tiles require the existing authorized tile URL and attribution configuration. Never place Booking.com Demand, Expedia Rapid or other partner secrets in `VITE_` variables. No backend is added merely to simulate commercial access.

Search transmits destination coordinates/category/name to Geoapify; details transmit the public property ID. Eligible media resolution transmits Wikidata/file references to Wikimedia. Neither budget nor traveler identities are transmitted. Map tiles reveal the viewed tile area and normal network metadata. No GPS permission is requested.

## Verification and limitations

Domain, provider, repository, route interaction and Leaflet tests use mocked network responses. `dev/accommodation-qa.html` is a development-only browser harness using real application routes/components and adapter normalization with visibly labeled fictional records in an isolated sessionStorage key. It never seeds the production Trip key and is absent from the production build. This verifies UI integration, not live Geoapify connectivity. See `PROMPT_07_REPORT.md` for executed checks and responsive/browser evidence.

No Geoapify key or commercial credentials were available for this phase. Therefore real hotel search, live property details and real accommodation photo retrieval remain unverified. Prices and availability are unavailable. Metadata and geographic coverage may be incomplete; photos may be missing. The hosted site has not been changed. Prompt 08 consumes only a selected stay's validated identity/coordinates, and Prompt 09 consumes only the accommodation cost boundary's explicit unknown state; neither changes accommodation search or selection semantics. Checkout, payments, authentication and verified accommodation pricing remain out of scope.
