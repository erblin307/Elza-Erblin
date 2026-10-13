# Architecture

## Technology stack

The application uses React and strict TypeScript, Vite, React Router, CSS Modules with global semantic tokens, Lucide React icons, Zod validation, React context, browser localStorage behind a typed repository, and Vitest with Testing Library.

## Folder structure

```text
src/
├── app/                 # Application routes and cross-cutting providers
├── components/          # Brand, layout, and focused UI primitives
├── features/trips/      # Trip pages, domain types, services, validation, utilities
├── styles/              # Global semantic tokens and reset
├── test/                # Shared test setup
└── main.tsx             # Browser entry point
```

## Domain boundaries

`features/trips` owns the Trip model, input validation, display calculations, repository contract, browser implementation, and pages. Cross-cutting theme behavior lives in an app provider. Layout and low-level reusable controls do not depend on trip storage.

Future modules should be sibling feature directories. They may reference stable trip IDs through deliberate contracts, but must not reach into the localStorage implementation.

## Routing

- `/` — Home and first-use state.
- `/trips` — Saved trip library.
- `/plan` — Initial trip creation.
- `/trips/:tripId` — Basic trip overview.
- Any other path — not-found page.

Routes share one responsive application shell and are defined once in `src/app/App.tsx`.

## Persistence

`TripRepository` defines asynchronous `list`, `get`, `create`, and `delete` operations. `LocalStorageTripRepository` is the current adapter. It stores a versioned envelope, validates records on read, generates stable IDs, and converts parse/read/write failures into explicit storage errors. React consumes the interface through `TripsProvider` and never calls localStorage from page components.

This is device-local browser persistence, not cloud synchronization. A later backend adapter can implement the same contract; authentication, conflict resolution, migration, and remote error semantics must be designed at that time.

## Date strategy

Travel dates are ISO `YYYY-MM-DD` calendar strings. Validation checks real calendar dates and compares strings without converting them to instants. Formatting constructs local calendar dates from numeric parts, avoiding UTC timezone shifts.
