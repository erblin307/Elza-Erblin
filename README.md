# Smart Travel Planner

A focused React workspace for creating and organizing the essentials of a trip. This first milestone is deliberately small: it establishes a professional application foundation without pretending that maps, bookings, itinerary generation, AI assistance, or cloud sync already exist.

## Setup

Requirements: Node.js 20.19+ (Node 24 recommended) and npm.

```bash
npm install
npm run dev
```

Open the exact local URL printed by Vite.

## Commands

```bash
npm run dev       # start the local development server
npm run build     # type-check and build production assets
npm run preview   # preview the production build
npm run lint      # run ESLint
npm test          # run the test suite once
```

## Implemented

- Original Route Frame SVG brand mark and favicon.
- Responsive desktop, tablet, and mobile application shell.
- Light, Dark, and System themes with persisted preference.
- Home, My Trips, New Trip, Trip Overview, and not-found screens.
- Field-level validation for route, dates, travelers, budget, and currency.
- Create, list, open, persist, reload, and delete trip flows.
- Versioned localStorage repository with invalid-data and storage-failure handling.
- Strict TypeScript, linting, and practical domain/repository tests.

## Persistence and privacy

Trips are stored only in the current browser using localStorage. There is no account, server database, remote API, collaboration, or cloud synchronization in this milestone. Clearing browser storage removes the saved trips.

## Current limitations

There is no authentication, remote backup, multi-device sync, map, place search, itinerary editor, accommodation or transport comparison, booking integration, budget engine, flight data, payment system, or AI assistant. The supplied `logo.png` remains a project reference; the product UI uses the accessible theme-aware SVG component.

## Documentation

- `DESIGN_RULES.md` — permanent visual and interaction rules.
- `docs/PRODUCT_SPEC.md` — product goals and milestone boundaries.
- `docs/ARCHITECTURE.md` — code structure and provider strategy.
- `docs/IMPLEMENTATION_NOTES.md` — concise phase history.
