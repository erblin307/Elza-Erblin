# Places and media integration — Prompt 06

## Providers and configuration

Geoapify supplies real destination identity, coordinates, categories and available place metadata. Leaflet/OpenStreetMap remains the existing map architecture. No Google Places content or photos are integrated.

Create a local `.env.local` from `.env.example`, supply a **public browser** `VITE_GEOAPIFY_API_KEY`, and restart Vite. Restrict the key to authorized application origins and appropriate provider quotas. Frontend variables are visible in the browser: never use a private/server-only credential. No key is committed. Missing configuration shows an explicit notice and leaves saved trips/itineraries/maps accessible. Set `VITE_WIKIMEDIA_CONTACT` to a public application page/contact for the Wikimedia `Api-User-Agent`; development falls back to the application origin. Production map tiles still require the separate Prompt 05 tile configuration.

Documented requests:

| Purpose | Endpoint / bounded parameters |
| --- | --- |
| Destination choices | `https://api.geoapify.com/v1/geocode/search` — current destination text, `type=city`, `limit=5`, GeoJSON |
| Nearby places | `https://api.geoapify.com/v2/places` — categories, `filter=circle:lon,lat,meters`, proximity bias, `limit=30`, optional documented `name` parameter |
| Selected details | `https://api.geoapify.com/v2/place-details` — exact `id`, `features=details` |
| Exact media entity | `https://www.wikidata.org/w/api.php` — `wbgetentities`, exact Q-ID, claims |
| Licensed file metadata | `https://commons.wikimedia.org/w/api.php` — `query`, `prop=imageinfo`, exact file title, `url|extmetadata|mime`, 480px thumbnail |

Sources: [Geoapify geocoding](https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/), [Places/categories/name search](https://apidocs.geoapify.com/docs/places/), [Place Details](https://apidocs.geoapify.com/docs/place-details/), [Commons Imageinfo](https://www.mediawiki.org/wiki/API:Imageinfo), [Wikimedia API etiquette](https://www.mediawiki.org/wiki/API:Etiquette). The supplied nested place-details documentation URL redirects; the actual Place Details documentation is used above. Geoapify documents permission to cache/store results; underlying OpenStreetMap attribution/ODbL duties remain relevant. Validate the deployment plan and applicable terms when activating the provider.

## Destination and search

Every match, including a single match, needs explicit user selection and confirmation. The repository saves optional validated `Trip.destinationResolution` with provider ID, location, original destination label, formatted location and retrieval time. Original destination text is never overwritten. Invalid optional metadata is isolated from the healthy Trip core and preserved. Meaningful destination edits clear the resolution; whitespace/case-only changes do not. No hardcoded live city centers or guessed coordinates.

Search defaults to 5 km; UI options are 2/5/10/20 km, adapter bounds 1–20 km. Results represent only that circle and provider coverage, not an exhaustive city inventory. Name search uses Geoapify's server parameter; the fixture source explicitly filters its small offline dataset. All Places searches include all five supported branches unless the user selects a category. Results remain visible even when they do not match saved interests.

| UI/category preference | Actual provider keys |
| --- | --- |
| History / architecture | `tourism.sights` |
| Museums / culture | `entertainment.museum` |
| Food | `catering.restaurant`, `catering.cafe` |
| Nature / relaxation | `leisure.park` |

`categories.ts` owns both provider-to-interest translation and interest-to-generator queries. Unsupported shopping/adventure/nightlife interests do not create invented provider categories. Discovery ranking reuses the existing pure `rankCandidates` and explanatory reasons. Generator live mode uses `GeoapifyCandidateProvider` with confirmed destination and relevant categories, 5 km / 30 candidates; no fixture fallback. This is a bounded heuristic, not rating/confidence prediction.

## Normalization and persistence

`Place` extends the existing validated activity candidate. Shared latitude/longitude validation is reused. Required stable provider ID, name, valid coordinates and recognized category translation are checked per record. Optional address, safe HTTP(S) website, explicit Wikidata/OSM references and raw opening-hours text are preserved when available. Invalid records are excluded independently. Provider-ID duplicates merge meaningful categories/references; conflicting coordinates quarantine that identity. Equal names with different provider IDs remain distinct. Display names and array indexes are never identities. Details must contain one selected details record and cannot change the requested entity ID.

Add-to-itinerary selects one of the existing real calendar dates and calls the existing mutation service, then `TripsProvider.saveItinerary`. Catalog metadata is stored once; day occurrences reference candidate IDs. Repeated provider entities and duplicate clicks are guarded. Owner, context, capacity, budget and day validation remain active. A previously absent itinerary is initialized as an empty artifact through the existing generator, not a disconnected list. Source identity, coordinates, categories, permitted details and validated media metadata survive reload. Search results themselves are transient. Changing confirmed destination identity makes an older itinerary stale; manual work is preserved until explicit regeneration. Fixtures/provider mixtures have visible source disclosure. Metadata refresh is explicit in the selected discovery details view; saved snapshots are not automatically replaced.

The existing map adapter derives the new marker from the saved catalog/day reference. No marker data is independently persisted and no map is rewritten. Planned links use existing item deep links. Unsaved discovery previews are not implemented.

## Media identity and licensing

Only a place's explicit Wikidata Q-ID is used; brand IDs, city keyword searches and spelling-based guesses are not. The exact returned entity must match, and a non-deprecated Earth P625 coordinate must be within 2 km of the provider point. This is an identity safety check, not routing or a guarantee of correct upstream data. Missing/contradictory identifiers or coordinates produce no image.

The resolver selects a non-deprecated P18 image from that verified entity, preferring preferred-rank statements and choosing a stable file among equivalent same-entity alternatives. It queries that exact Commons file, requiring a matching title, JPEG/PNG/WebP thumbnail on `upload.wikimedia.org`, author, license name, source page and accepted license URL. HTML metadata becomes plain text; scripts/styles are removed. Files with restrictions, missing attribution or unknown licenses are rejected. The accepted URL allowlist covers CC BY / BY-SA versions 1.0/2.0/2.5/3.0/4.0, CC0 and Public Domain Mark 1.0; other licenses/formats conservatively fall back. Only one file is checked per entity lookup; alternative-file retry loops are not implemented.

One normalized `TravelImage` holds identity/file title and required attribution. One reusable component supplies responsive 4:3 imagery, meaningful alt text, lazy/async loading, loading/error/missing fallbacks and visible author/credit/source/license links. Stored image entity IDs must match the candidate reference. Selected details request media; there is no external request per rendered card. Successfully resolved media also enriches that search row and can be persisted when added. Existing itinerary/map activity details reuse the same image component. No unrelated stock image or AI-generated substitute is used.

## Request and error controls

Each provider client allows at most 20 requests per rolling minute, deduplicates pending URLs and keeps up to 100 responses in a five-minute in-memory cache. Searches have a 10-second timeout and AbortSignal cancellation. After the initial explicit search, category/name/radius changes are debounced 400 ms; stale requests cannot replace new results. Wikimedia lookups are serial. HTTP 429 applies a bounded 30–300-second cooldown using Retry-After when available; no automatic retry loops. These browser-local controls supplement, not replace, account-level quotas and origin restrictions. Multiple tabs/users share provider billing, not this local counter.

Missing key, 401/403, quota/rate limits, timeout, malformed data, failed network, unresolved destinations and empty filters have explicit restrained states. Errors never expose keys/request URLs. Photo failure returns a neutral image state and retains the place card. Canceling or leaving a trip aborts requests. Existing artifacts survive failed requests/saves.

## Unknown facts, fixtures and limitations

No ticket prices, ratings, visit durations or availability are invented. Missing costs remain unknown, not free. Scheduling uses the existing default 60-minute unknown-duration assumption (or the saved artifact's configured value), explicitly labeled as planning guidance. OpenStreetMap-style hours are preserved with source metadata but not parsed, displayed raw, or treated as open-now; timezone interpretation is not implemented. No fabricated descriptions.

Development Places fixtures explicitly reuse static, sourced Rome/Vienna landmark points from Prompt 05. Their demonstration area is anchored to a landmark, **not live geocoding or a city center**. No restaurants, nature listings, prices or hours are fabricated to fill empty categories. These records remain labeled fixtures even if a real Commons image can be resolved. Generic itinerary fixtures retain separate sample-price disclosures.

Coverage depends on Geoapify/OpenStreetMap and the selected radius; real-world record completeness varies. Media requires reliable identity/coordinates and eligible licenses, so many places have no photograph. Live Geoapify access was not verified without credentials. The browser Colosseum media attempt produced no usable image; successful live Commons rendering is not claimed. Mocked tests verify the endpoint, normalization, licensing and persistence contracts. No hotels, flights, booking, route optimization, payments, authentication or full budget engine were added.
