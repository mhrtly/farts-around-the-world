# Persistence Review Note

Date: 2026-03-07
Prepared for: Claude review
Prepared by: Codex

## Situation

You reported that multiple real uploads recorded in the morning were no longer visible later in the day.

The main concern was that the database might not be permanently storing recordings.

## What I Found

### 1. Local SQLite was persisting data

The backend stores data in:

- [server/db.js](/Users/markhartley/Documents/Farts_Around_The_World_App/server/db.js)
- SQLite file: [server/farts.db](/Users/markhartley/Documents/Farts_Around_The_World_App/server/farts.db)

When inspected locally, the database file was not empty and did contain stored rows. That means the code path itself was capable of persisting data to disk.

### 2. The repo strongly suggests Render hosting

There is a checked-in Render config:

- [render.yaml](/Users/markhartley/Documents/Farts_Around_The_World_App/render.yaml)

It defines a Render `web` service, but it does **not** define any persistent disk configuration.

### 3. That likely explains disappearing production data

If the live site is running on Render from the current setup, then SQLite is very likely living on ephemeral container storage.

That means data can disappear when the service:

- redeploys
- restarts
- is replaced by Render infrastructure

### 4. Product/data-model issue also existed

The app had legacy/demo-style non-audio rows mixed into the same event table, which made the product state less trustworthy than it should be for a real recording-first app.

## Changes I Already Made On My Branch

Branch:

- `codex/fatwa-express-persistence`

Implemented on that branch:

### Backend/data changes

- Canonicalized the dataset around audio-backed recordings only.
- Rejected new non-audio event submissions.
- Filtered event queries/stats to audio-backed recordings only.
- Removed legacy non-audio rows from the local SQLite file on startup.

Touched files:

- [server/db.js](/Users/markhartley/Documents/Farts_Around_The_World_App/server/db.js)
- [server/routes.js](/Users/markhartley/Documents/Farts_Around_The_World_App/server/routes.js)
- [server/validation.js](/Users/markhartley/Documents/Farts_Around_The_World_App/server/validation.js)

### Frontend behavior changes

- Bootstrapped app state from persisted `/api/events` instead of relying on socket handshake history loading.
- Updated the submit path so successful uploads are reflected immediately in UI state.
- Added a mobile-first `FATWA Express` mode for smaller screens.

Touched files:

- [src/App.jsx](/Users/markhartley/Documents/Farts_Around_The_World_App/src/App.jsx)
- [src/data/liveFartStream.ts](/Users/markhartley/Documents/Farts_Around_The_World_App/src/data/liveFartStream.ts)
- [src/components/HUD/SubmitPanel.jsx](/Users/markhartley/Documents/Farts_Around_The_World_App/src/components/HUD/SubmitPanel.jsx)
- [src/components/HUD/FartBrowser.jsx](/Users/markhartley/Documents/Farts_Around_The_World_App/src/components/HUD/FartBrowser.jsx)
- [src/components/HUD/FATWAExpressPanel.jsx](/Users/markhartley/Documents/Farts_Around_The_World_App/src/components/HUD/FATWAExpressPanel.jsx)
- [src/styles/app.css](/Users/markhartley/Documents/Farts_Around_The_World_App/src/styles/app.css)

### Verification

- `npm run build` passed locally.
- Direct backend inspection confirmed local SQLite was storing audio-backed rows.

## Recommendation

### Short-term recommendation

Add a **Render persistent disk** and point SQLite at the mounted disk path.

Reason:

- fastest path to stop production data loss
- minimal code churn
- preserves current backend shape
- probably under 1 hour if handled cleanly

### Medium-term recommendation

Migrate from SQLite to **Postgres**.

Reason:

- better production fit
- safer scaling path
- better concurrency
- cleaner foundation for accounts, moderation, reporting, and future features

Estimated implementation:

- quick first migration: roughly `4-8 hours`
- safer full migration with cleanup and deployment validation: `1-2 days`

## Suggested Path

1. Confirm whether production is in fact using Render with the checked-in [render.yaml](/Users/markhartley/Documents/Farts_Around_The_World_App/render.yaml).
2. If yes, add persistent disk support immediately to stop losing uploads.
3. Deploy and verify that a fresh upload survives restart/redeploy.
4. After that, decide whether to schedule a Postgres migration now or after the next product milestone.

## Specific Question For Claude

Please review:

- whether the Render-hosting inference is correct from repo context
- whether the persistent-disk-first recommendation is the right immediate move
- whether my branch changes should be kept as-is, trimmed, or split before merge
- whether Postgres should start now or after the persistence hotfix lands
