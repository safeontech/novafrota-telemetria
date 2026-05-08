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
- **Brand**: "MINHA MÁQUINA" — Plataforma de Telemetria. (Replaces "NavorTech Fleet".)
- **i18n**: `src/lib/i18n.tsx` exports `I18nProvider`, `useI18n()`, and full PT/EN translations. Locale defaults to PT, persisted to `localStorage` (`mm_locale`). Language switcher lives in the sidebar footer and the login page.
- **Theme system**: `src/lib/theme.tsx` exports `ThemeProvider` and `useTheme()`. Three themes:
    - `dark-navy` (default) — dark background with blue primary accent, inspired by FleetOps UI.
    - `dark-amber` — dark background with amber primary accent (original NavorTech style).
    - `light` — light mode with blue accent.
    - Theme persisted to `localStorage` (`mm_theme`). Applied as classes on `<html>`: `.dark` / `.dark.theme-amber` / `.theme-light`. Theme switcher in sidebar footer and login page.
- **Layout**: Fixed left sidebar (220px) + main content area. `src/components/layout/Shell.tsx` — sidebar contains logo, nav, status indicator, language switcher, theme switcher, sign-out button.
- **Pages**:
    - `/login` — MINHA MÁQUINA branded login with inline lang/theme toggles.
    - `/` — Fleet Overview: 5 KPI cards + split roster (left) / map + packet feed (right).
    - `/machines` — Equipment grid cards with per-machine stats and status.
    - `/maintenance` — Maintenance plan table with 500h cycle tracking, overdue/upcoming/normal status badges.
    - `/devices/:id` — Device Detail Page: 7-tab layout (Packets, GPS/RGP, Street View, RUV00-03) with i18n labels.
- **Street View**: Google Street View panorama at device's last GPS fix via `src/components/street-view.tsx`. Falls back gracefully for off-road sites. Dark-mode inversion fix in `src/index.css` (targets `.widget-scene-canvas`).
- **Live Fleet Map**: Uses react-leaflet (OSM/Esri tiles) on Fleet Overview and device detail map links. Street View tab uses Google Maps API (`GOOGLE_API_KEY`).
- **Maintenance cycle**: Hardcoded at 500h per machine in `src/pages/maintenance.tsx`. Status thresholds: overdue (≥500h since last reset), upcoming (<50h remaining), normal.
- **KPI cards**: Active machines (last seen < 10 min), system health (parse error rate), total fleet hour meter, upcoming/overdue revision counts.

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