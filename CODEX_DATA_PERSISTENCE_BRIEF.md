# Codex Mission Brief: Data Persistence Fix

**Date**: 2026-03-07
**From**: Quipu (Chief of Staff)
**To**: Chasqui (Codex)
**Priority**: CRITICAL — Production data is being lost
**Directive from Spudnik**: "Stop the bleeding ASAP, then build a better system."

---

## Situation Assessment

Your analysis in `PERSISTENCE_REVIEW_NOTE.md` was **excellent**. Every inference is correct:

1. **Yes, production is on Render** — confirmed by `render.yaml`
2. **Yes, there is no persistent disk** — the `render.yaml` has zero disk config
3. **Yes, this is why data disappears** — SQLite writes to ephemeral container storage
4. **Yes, persistent-disk-first is the right immediate move**

Your branch changes (`codex/fatwa-express-persistence`) are solid work. The audio-canonicalization and non-audio cleanup are good calls.

---

## Phase 1: Stop the Bleeding (DO THIS FIRST)

**Goal**: Make SQLite survive Render restarts/redeploys. Target: < 1 hour.

### Step 1: Add Render Persistent Disk

Update `render.yaml` to:

```yaml
services:
  - type: web
    name: farts-around-the-world
    runtime: node
    buildCommand: npm install && npm run build && cd server && npm install
    startCommand: node server/index.js
    envVars:
      - key: NODE_ENV
        value: production
    disk:
      name: fatwa-data
      mountPath: /data
      sizeGB: 1
```

**Notes**:
- Render persistent disks survive restarts and redeploys
- 1 GB is more than enough for SQLite + audio blobs at our scale
- The `mountPath` must be an absolute path inside the container
- Render persistent disks cost ~$0.25/GB/month — negligible

### Step 2: Make `server/db.js` Use the Disk Path in Production

The DB_PATH logic needs to check for the persistent mount:

```js
const __dirname = dirname(fileURLToPath(import.meta.url))

// In production on Render, use the persistent disk mount.
// Locally, keep using the project-relative path.
const DB_PATH = process.env.NODE_ENV === 'production'
  ? '/data/farts.db'
  : join(__dirname, 'farts.db')
```

**Why this works**:
- In production (`NODE_ENV=production` is already set in render.yaml), SQLite writes to `/data/farts.db` which is on the persistent disk
- Locally, nothing changes — still uses `server/farts.db`
- The WAL files (`farts.db-wal`, `farts.db-shm`) will automatically be created alongside the main DB file on the persistent disk

### Step 3: Add a Console Log to Confirm

Add a log line after the DB is opened so we can verify in Render logs:

```js
console.log(`[DB] Using database at: ${DB_PATH}`)
console.log(`[DB] Environment: ${process.env.NODE_ENV || 'development'}`)
```

### Step 4: Verify After Deploy

After deploying:
1. Submit a test event via the app (use the Record button)
2. Note the event details
3. Trigger a redeploy (push an empty commit or click "Manual Deploy" in Render dashboard)
4. After redeploy, check `/api/events` — the test event should still be there
5. Check `/api/health` — `eventCount` should be > 0

### Files to Touch (Phase 1)
- `render.yaml` — add disk config
- `server/db.js` — environment-aware DB_PATH (change only lines 5-6)

**That's it.** Two files, minimal changes. Ship this immediately.

---

## Phase 2: Postgres Migration (After Phase 1 is Deployed and Verified)

**Goal**: Replace SQLite with Postgres for production. Target: 1-2 days.

### Why Postgres?
- SQLite is a single-writer database — fine for now, but will bottleneck with concurrent users
- Postgres handles concurrent writes natively
- Render offers managed Postgres — zero ops overhead
- Better foundation for future features (user accounts, moderation, search)
- Audio blobs should eventually move to object storage (S3), but that's Phase 3

### Architecture

```
Production:
  Render Web Service → Postgres (Render managed)

Development:
  Local Node → SQLite (unchanged — no Postgres needed for dev)
```

### Step-by-Step

#### 2a. Provision Render Postgres

In the Render dashboard (or via render.yaml):

```yaml
databases:
  - name: fatwa-db
    plan: starter  # $7/month, 1GB storage, 256MB RAM
    databaseName: fatwa
    user: fatwa_user

services:
  - type: web
    name: farts-around-the-world
    runtime: node
    buildCommand: npm install && npm run build && cd server && npm install
    startCommand: node server/index.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: fatwa-db
          property: connectionString
    disk:
      name: fatwa-data
      mountPath: /data
      sizeGB: 1
```

**Keep the disk** even after Postgres migration — we might need it for audio file caching or other local storage.

#### 2b. Add `pg` Dependency

In `server/package.json`:
```
npm install pg
```

#### 2c. Create `server/db-postgres.js`

New file that mirrors the exact same export interface as `db.js`:

```
Export functions (must match existing interface):
- insertEvent(event)
- getRecentEvents(limit)
- getEventsByRange(start, end)
- getAudio(eventId)
- getDatabasePath()  → return 'postgres' or the connection string (masked)
- updateEventRating(id, rating)
- getStats()
```

**Schema** (Postgres version):

```sql
CREATE TABLE IF NOT EXISTS events (
  id          UUID PRIMARY KEY,
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  intensity   INTEGER NOT NULL CHECK (intensity >= 1 AND intensity <= 10),
  country     CHAR(2) NOT NULL,
  timestamp   BIGINT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('standard', 'epic', 'silent-but-deadly')),
  audio_data  TEXT DEFAULT NULL,
  user_rating INTEGER DEFAULT NULL,
  duration    DOUBLE PRECISION DEFAULT NULL,
  volume      DOUBLE PRECISION DEFAULT NULL,
  peak_volume DOUBLE PRECISION DEFAULT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_country ON events(country);
CREATE INDEX IF NOT EXISTS idx_events_has_audio ON events((audio_data IS NOT NULL));
```

**Key differences from SQLite**:
- `UUID` type instead of `TEXT` for id
- `DOUBLE PRECISION` instead of `REAL`
- `BIGINT` instead of `INTEGER` for timestamp
- `TIMESTAMPTZ` instead of `TEXT` for created_at
- Partial index on `audio_data IS NOT NULL` for faster filtered queries
- Use parameterized queries (`$1, $2, $3`) instead of SQLite's (`@param`) syntax

#### 2d. Create `server/db-adapter.js` (Router)

Simple adapter that picks the right implementation:

```js
// If DATABASE_URL is set, use Postgres. Otherwise, use SQLite.
const usePostgres = !!process.env.DATABASE_URL

const db = usePostgres
  ? await import('./db-postgres.js')
  : await import('./db.js')

export const {
  insertEvent,
  getRecentEvents,
  getEventsByRange,
  getAudio,
  getDatabasePath,
  updateEventRating,
  getStats,
} = db

export default db.default
```

Then update `server/routes.js` and `server/index.js` to import from `./db-adapter.js` instead of `./db.js`.

#### 2e. Data Migration Script

Create `server/migrate-sqlite-to-postgres.js`:
- Reads all rows from SQLite `farts.db`
- Inserts them into Postgres via batch INSERT
- Logs progress and row counts
- Run once during the transition

#### 2f. Verify

- Locally: `DATABASE_URL` not set → uses SQLite (no change for dev)
- On Render: `DATABASE_URL` auto-injected → uses Postgres
- Submit events → check they persist across redeploys
- Run migration script to carry over any events from the SQLite persistent disk

### Files to Create (Phase 2)
- `server/db-postgres.js` — Postgres implementation
- `server/db-adapter.js` — Router that picks SQLite or Postgres
- `server/migrate-sqlite-to-postgres.js` — One-time migration script

### Files to Modify (Phase 2)
- `server/routes.js` — Change import from `./db.js` to `./db-adapter.js`
- `server/index.js` — Change import from `./db.js` to `./db-adapter.js`
- `server/package.json` — Add `pg` dependency
- `render.yaml` — Add database config + DATABASE_URL env var

### Files to Keep Unchanged
- `server/db.js` — Still used for local development
- `server/validation.js` — No changes needed (already correct)

---

## Branch Strategy

### Phase 1 Branch
Work on your existing branch: `codex/fatwa-express-persistence`

Make a clean, focused commit:
```
fix: add Render persistent disk to prevent SQLite data loss

- Add disk config to render.yaml (1GB persistent mount at /data)
- Make db.js use /data/farts.db in production environment
- SQLite data now survives Render restarts and redeploys
```

**This should be merged to main ASAP.** Don't bundle it with other changes.

### Phase 2 Branch
Create a new branch: `codex/postgres-migration`

Multiple commits as you build:
1. Add pg dependency + db-postgres.js skeleton
2. Implement all Postgres query functions
3. Create db-adapter.js router
4. Update routes.js + index.js imports
5. Add migration script
6. Update render.yaml with database config

---

## Review of Your Existing Branch Changes

Your `codex/fatwa-express-persistence` branch changes are good. Here's what to **keep, trim, and split**:

### KEEP (merge with Phase 1)
- `render.yaml` persistent disk addition
- `server/db.js` — environment-aware DB_PATH
- `server/db.js` — legacy non-audio row cleanup on startup
- `server/validation.js` — audioData required, defaults for intensity/type

### KEEP BUT MERGE SEPARATELY (after Phase 1)
- `src/App.jsx` — bootstrap from `/api/events` (this is a frontend improvement, not a persistence fix)
- `src/components/HUD/FATWAExpressPanel.jsx` — mobile UX improvements
- `src/data/liveFartStream.ts` — any changes here
- `src/styles/app.css` — any styling changes

**Rationale**: The persistence fix (render.yaml + db.js) should be its own atomic commit that can be deployed instantly. Frontend improvements can follow in a second commit/PR. This way if the persistence fix needs a hotfix, it's clean to revert or amend without tangling with UI changes.

### TRIM
- Nothing needs to be removed — your changes are well-scoped

---

## Current Database Schema (For Reference)

The current `server/db.js` schema (what you're working with):

```sql
events (
  id          TEXT PRIMARY KEY,
  lat         REAL NOT NULL,
  lng         REAL NOT NULL,
  intensity   INTEGER NOT NULL CHECK(1-10),
  country     TEXT NOT NULL,
  timestamp   INTEGER NOT NULL,
  type        TEXT NOT NULL ('standard'|'epic'|'silent-but-deadly'),
  created_at  TEXT DEFAULT datetime('now'),
  audio_data  TEXT DEFAULT NULL,       -- base64 encoded audio
  user_rating INTEGER DEFAULT NULL,    -- 1-10
  duration    REAL DEFAULT NULL,       -- seconds, 0-10
  volume      REAL DEFAULT NULL,       -- RMS average, 0-100
  peak_volume REAL DEFAULT NULL        -- peak, 0-100
)
```

All SELECT queries already filter `WHERE audio_data IS NOT NULL`.
Legacy non-audio rows are deleted on startup.

---

## Important Constraints

1. **Don't modify the event schema shape** — the frontend expects `{ id, lat, lng, intensity, country, timestamp, type, hasAudio, duration, volume, peakVolume }` from the API
2. **Don't change the API routes** — `/api/events`, `/api/events/:id/audio`, `/api/stats`, `/api/health` must keep working identically
3. **Don't change WebSocket event names** — `fart:new`, `fart:burst`, `stats:update` are wired into the frontend
4. **Don't add new npm dependencies to the frontend** — only `server/package.json` gets `pg`
5. **`server/db.js` must still work standalone** for local development without Postgres

---

## Success Criteria

### Phase 1 Complete When:
- [ ] A fart submitted on the live site survives a Render redeploy
- [ ] `/api/health` shows `eventCount > 0` after restart
- [ ] Console logs confirm `[DB] Using database at: /data/farts.db`

### Phase 2 Complete When:
- [ ] Local dev still uses SQLite (no Postgres required)
- [ ] Production uses Postgres (auto-detected via DATABASE_URL)
- [ ] All existing events migrated from SQLite → Postgres
- [ ] All API endpoints return identical responses
- [ ] Audio playback still works
- [ ] WebSocket events still broadcast correctly

---

## Questions?

If anything is unclear, ask Mark (the human emperor) or open a PR with your progress and tag for review. Speed matters here — every Render restart is losing real user data.

**Phase 1 is a < 1 hour fix. Ship it today.**
