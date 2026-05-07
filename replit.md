# Overview

This project is a pnpm workspace monorepo utilizing TypeScript, designed to provide a comprehensive solution for managing NavorTech XVM device data. It encompasses an ingest gateway for XVM data, a read API, and a React-based dashboard for fleet operators. The primary purpose is to process real-time tracking data, persist it, and make it accessible and visualizable for fleet management.

Key capabilities include:
- Ingesting XVM data via UDP and TCP protocols.
- Persisting device, packet, frame, and report data into a PostgreSQL database.
- Providing a robust API for querying device and report data.
- Offering a web-based dashboard for fleet operators to monitor devices on a Google Map, view historical data, and track KPIs.

The project aims to deliver a reliable and scalable platform for NavorTech's fleet management needs.

# User Preferences

- **Vendor / customer message drafts** (e.g. WhatsApp replies to Pablo Mota at Safeon, Leonardo Dias, etc.): always provide BOTH English and Portuguese versions side by side. Pablo writes in Portuguese; the user (Farrell) prefers to see the English first so they can verify intent, then the Portuguese ready to copy-paste. Match the casual tone Pablo uses on WhatsApp.

# System Architecture

## Monorepo Structure and Tooling
The project is organized as a pnpm workspace monorepo, with each package managing its own dependencies.
- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Build**: esbuild (CJS bundle)

## Data Persistence Layer (`lib/db`)
- **Database**: PostgreSQL with Drizzle ORM.
- **Schema**: Designed to mirror the protocol decode pipeline, including `devices`, `packets`, `frames`, and specific `reports_{rgp,ruv00,ruv01,ruv02,ruv03}` tables.
- **Indexing**: Optimized for "latest report per device" and fleet-wide time-window queries.
- **Deduplication**: Application-layer deduplication is implemented for `frames` to handle 16-bit message number rollovers.

## API Server (`artifacts/api-server`)
- **Framework**: Express 5.
- **Endpoints**: Provides read access for health checks, device listings, individual device details, and paginated packets/reports.
- **Validation**: Inputs are validated using Orval-generated Zod schemas (v3), returning HTTP 400 for validation errors.
- **Error Handling**: Centralized error handling distinguishes between Zod v3 and v4 errors to ensure correct HTTP 400 responses.
- **Authentication**: Bearer token middleware (`API_READ_TOKEN`) secures all endpoints except `/healthz`. In development, authentication can be bypassed with a warning; in production, `API_READ_TOKEN` is mandatory.

## Dashboard (`artifacts/dashboard`)
- **Frontend**: React SPA built with Vite.
- **Deployment**: Served same-origin with the API server to avoid CORS issues.
- **Authentication**: API token stored in `localStorage` and managed by `useApiToken()` hook, with a global 401 handler for session expiry.
- **Routing**: Handled by `wouter`, with `RequireAuth` guard for protected routes.
- **UI/UX**: Dark/amber theme with NavorTech branding.
- **Key Features**:
    - **Login Page**: For entering the API token.
    - **Fleet Overview**: Displays KPIs, a Live Fleet Map, animated fleet roster, and raw packet feed.
    - **Device Detail Page**: Offers seven tabs for detailed views of Packets, RGP, **Street View** (Google Street View panorama at the device's last GPS fix via `src/components/street-view.tsx` — uses `google.maps.StreetViewService.getPanorama()` with 250m search radius and `OUTDOOR` source, falls back to a friendly "no imagery in this area" panel with an "Open in Google Maps" link for off-road job sites), RUV00-03, with charts for RUV data using `recharts`.
    - **Street View dark-mode workaround**: Google's panorama renderer auto-applies an inline `filter: invert(1)` on its WebGL canvas when it detects a dark color preference (which our amber/dark theme triggers), producing photo-negative imagery (purple trees, orange sky). Since `StreetViewPanoramaOptions` has no `colorScheme` field and `@vis.gl/react-google-maps`'s `APIProvider` doesn't forward `color_scheme` to the loader URL, the fix lives in `src/index.css`: an `!important` rule targeting `.widget-scene-canvas, .mapsImagerySceneScene__canvas` resets `filter: none`, overriding Google's inline style.
- **Live Fleet Map**:
    - Uses **Google Maps JavaScript API** via `@vis.gl/react-google-maps`.
    - Custom **isometric Bobcat (skid-steer loader) icon markers** (`src/assets/bobcat-marker.png`, AI-generated, transparent background) inside a white circular badge with an amber ring — active devices show full color; stale (>10 min since last seen) devices fade with grayscale.
    - Info window displays device ID, coordinates, speed, ignition, timestamp, and **two action buttons**: a beige **"Details"** link to `/devices/{id}` and a bright amber **"Street View"** deep-link to `/devices/{id}?tab=streetview` (so operators can jump from a marker to the panorama in one click). The device-detail page reads the `?tab=` query param via wouter's `useSearch()` and gates it through a `VALID_TABS` whitelist, falling back to "packets" for unknown values.
    - Google Maps API key (`GOOGLE_API_KEY`) is injected at build time and restricted for security.

## XVM Ingest Gateway (`services/gateway`)
- **Listener**: Dual-transport listener on port 6600 (UDP and TCP) for VL06 and VL08 devices.
- **Packet Handling**:
    - Splits `>…<` frames, verifies XOR-LRC, decodes various report types.
    - ACKs device-originated frames to prevent retransmissions.
    - Appends raw packets to `fixtures/xvm-live.txt` (NDJSON) for auditing.
- **Persistence Sink**: When `DATABASE_URL` is set, packets are persisted to the database.
    - Fire-and-forget mechanism to avoid blocking synchronous ACK replies.
    - Upserts device contact, inserts packet audit rows, performs 60-second deduplication, and inserts frame/report rows within a transaction.
    - Projects denormalized "latest-state" columns onto the device row.
- **TCP Framing**: Recovered by `lib/tcp-framer.ts` with per-connection accumulators and trailer-driven packet boundaries.

# External Dependencies

- **PostgreSQL**: Primary database for all persistent data.
- **Drizzle ORM**: Used for interacting with the PostgreSQL database.
- **Express**: Node.js web application framework for the API server.
- **Zod**: Schema declaration and validation library, used for API request/response validation.
- **Orval**: API codegen tool, used to generate API hooks and Zod schemas from an OpenAPI specification.
- **React**: Frontend library for building the user interface of the dashboard.
- **Vite**: Build tool for the React dashboard.
- **@vis.gl/react-google-maps**: Official React wrapper for the Google Maps JavaScript API, used in the dashboard's Live Fleet Map.
- **recharts**: Charting library used in the dashboard for displaying RUV data.
- **wouter**: Tiny routing library for React, used in the dashboard.
- **esbuild**: Bundler used for building various packages.