# CLAUDE.md — Farts Around The World App

> **Every Claude Code instance working in this repo MUST read and follow this file.**
> This is the single source of truth. COORDINATION.md and ARCHITECTURE.md are historical
> artifacts from the chaotic multi-agent bootstrap phase — they contain outdated/conflicting
> info. THIS file supersedes them.

---

## The Quipu — Team Coordination System

This project is coordinated like an Inca quipu: a system of knotted cords where each
thread tracks a different stream of information, and the Quipucamayoc (keeper) knows
how they all tie together. Every agent is a cord on the quipu. Stay in your lane,
tie clean knots, and the empire holds.

### The Crew

| Name | Role | Platform | Domain | Personality |
|------|------|----------|--------|-------------|
| **Spudnik** | Sapa Inca (Supreme Visionary) | Claude Web | Big picture, philosophy, feature design | The prophet of the potato. Speaks in manifestos. Sees the cosmic significance of flatulence. Issues decrees from the cloud. |
| **Quipu** | Quipucamayoc (Chief of Staff) | Claude Code | Coordination, architecture, CLAUDE.md, merges | The record-keeper. Reads every knot on every cord. Tracks what's built, what's broken, what's next. The only one who edits CLAUDE.md. |
| **Inti** | Sun Priest (Globe Master) | Claude Code | `src/components/Globe/*`, Three.js, visual FX | Named for the Inca sun god. The globe is the sun at the center of the dashboard and Inti makes it shine. Bloom, particles, arcs, heatmaps — if it glows on the sphere, it's Inti's work. |
| **Chaska** | Star Weaver (HUD Artisan) | Claude Code | `src/components/HUD/*`, `src/styles/*` | Named for Venus, the brightest star. Weaves the constellation of panels around the globe. CSS glassmorphism, animations, layout, typography — the neon sky surrounding Inti's sun. |
| **Wari** | Terrace Builder (Backend Engineer) | Claude Code | `server/*`, `src/data/*` | Named for the pre-Inca Wari civilization, master terrace-farmers and infrastructure builders. Lays the stone terraces (database), digs the irrigation channels (API routes), and keeps the water flowing (WebSocket). |
| **Chasqui** | Imperial Messenger | Codex (ChatGPT) | Targeted tasks, research, one-off scripts | Named for the Inca relay runners who carried quipus between cities. Fast, reliable for specific deliveries, but runs under different protocols. Give Chasqui a clear message and a clear destination — don't ask for improvisation. |

### How to Assign Work (for Mark)

When you open a new Claude Code thread, tell it who it is:

> *"You are **Inti**. Your job is to add UnrealBloomPass to GlobeCanvas.jsx.*
> *Only edit files in `src/components/Globe/`. Branch: `feature/bloom-effects`."*

> *"You are **Chaska**. Add a smooth slide-in animation to the KPI panels.*
> *Only edit files in `src/components/HUD/` and `src/styles/`. Branch: `feature/panel-animations`."*

> *"You are **Wari**. Wire up the live WebSocket stream to replace mock data.*
> *Edit `src/data/` and coordinate with Quipu before touching App.jsx. Branch: `feature/live-backend`."*

For Codex (Chasqui), use specific, self-contained prompts with all context included —
Chasqui doesn't read the quipu (CLAUDE.md), so spell everything out.

### The Potato Field (Architecture Metaphor)

Think of the codebase as an Inca potato field using the **waru waru** raised-bed system:

```
  SPUDNIK (Sapa Inca) — blesses the harvest from the cloud
      |
  QUIPU (Quipucamayoc) — tracks every terrace, every yield
      |
  ┌───┴───────────────────────────────┐
  |   THE WARU WARU (raised beds)     |
  |                                   |
  |  ┌─── Inti's Terrace ──────────┐  |    Globe layer — the sun
  |  |  GlobeCanvas.jsx            |  |    at the center of the field
  |  |  Three.js / bloom / arcs    |  |
  |  └─────────────────────────────┘  |
  |                                   |
  |  ┌─── Chaska's Terrace ────────┐  |    HUD panels — stars
  |  |  HUD/*.jsx + styles/*.css   |  |    surrounding the sun
  |  └─────────────────────────────┘  |
  |                                   |
  |  ┌─── Wari's Terrace ─────────┐  |    Infrastructure — the
  |  |  server/* + src/data/*      |  |    irrigation channels
  |  └─────────────────────────────┘  |    beneath the soil
  |                                   |
  |  ┌─── Shared Soil ────────────┐  |    App.jsx, config, types
  |  |  (coordinate via Quipu)    |  |    — touch only with
  |  └─────────────────────────────┘  |    Quipu's blessing
  |                                   |
  └───────────────────────────────────┘
       CHASQUI runs messages between fields
```

**Rule**: Stay on your terrace. If you need to dig into shared soil (App.jsx,
package.json, vite.config.ts), ask Quipu (this coordinating thread) first.

---

## Project Overview

**Farts Around the World** — a map of real fart recordings from real places.
Two core flows, and everything should serve them:

1. **Record & pin**: tap Record → 3-2-1 → capture up to 10s → review (real
   length / loudness / pitch) → post. The clip is trimmed, re-encoded as WAV,
   and pinned to the globe at the poster's location (rounded to ~1 km).
2. **Browse & listen**: spin the globe, tap a glowing dot (or pick from the
   list), hear it. Zoom from orbit down to ~12 km: dots split apart as you go
   in, and farts recorded at the same spot open into a ring of petals, one per
   fart. Shareable `/r/:id` links.

Real, and funny because it's real — no fictional "intelligence agency" copy.
The old mission-control dashboard lives in `_archive/hud-v1/`.

**Status (2026-09-25)**: Redesigned as **"Phosphor & Needle"** — the site is a
precise piece of night-time recording hardware for measuring farts (see Design
System below). One tap on the ceramic REC key goes straight to a 3-2-1; the
globe is a teal-graphite Earth with sodium city lights and phosphor farts; a
posted take prints a slip that flies to the globe and lands as a comet. Side
projects (Archive Lab, Sommelier Salon) sit behind the ⋯ menu.

---

## Stack (LOCKED — Do Not Change)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | React 18 (JSX) | No TypeScript components — all `.jsx` |
| Globe | `globe.gl` + `three-globe` + Three.js | 3D visualization |
| Bundler | Vite 6 | Config in `vite.config.ts` only |
| Styling | CSS custom properties, no glass | Per-area files in `src/styles/` (see Design System) |
| State | React `useState` in App.jsx | No Zustand (ignore old docs saying otherwise) |
| Backend | Express + Socket.IO + SQLite (better-sqlite3) | Port 3001 |
| Entry | `index.html` → `src/main.jsx` → `src/App.jsx` | Root: `<div id="root">` |

### Do NOT:
- Replace React with vanilla TypeScript
- Add Zustand, Redux, or other state libraries without explicit approval
- Swap globe.gl for MapLibre/deck.gl (ignore ARCHITECTURE.md saying this)
- Modify `package.json` dependencies without stating what and why
- Modify `vite.config.ts` without stating what and why

---

## Canonical Event Schema

```js
// FartEvent — the ONLY shape all code should use (every event has audio)
{
  id: string,            // UUID, server-generated
  lat: number,           // -90 to 90, rounded to 2 decimals (~1 km) for privacy
  lng: number,           // -180 to 180, rounded to 2 decimals
  country: string,       // ISO 3166-1 alpha-2 (any country; 'XX' if unknown)
  place: string | null,  // "Grand Canyon Village, Arizona" (older rows backfilled)
  timestamp: number,     // epoch ms, server-generated
  duration: number,      // seconds of actual sound
  volume: number | null,     // mean RMS × 100 of the sound
  peakVolume: number | null, // peak RMS × 100 (loudness words: src/utils/recordings.js)
  intensity: number,     // 1-10, derived from loudness
  type: 'standard' | 'epic' | 'silent-but-deadly',  // derived from length/loudness
  audioMimeType: string, // 'audio/wav' for new posts; older rows webm/opus
  hasAudio: 1
}
```

Audio is served from `GET /api/events/:id/audio`. Pitch is not stored — the
client measures it (and the waveform) in a Web Worker when a recording is
opened. The 28 recordings posted before the recorder measured anything were
backfilled with real values by `server/migrations/legacy-measurements-2026-09.json`
(applied idempotently on startup; the file keeps the old values).
Recordings within ~2 km share one site for the deck's "N at this spot" keys
(`groupIntoSites`). The globe groups by exact spot (same rounded coordinate)
and clusters by zoom instead (`Globe/clusters.js`).

---

## Project Structure

```
/
├── CLAUDE.md              ← YOU ARE HERE (single source of truth)
├── index.html             ← Splash (+ shared-link title card with PLAY) + fonts + meta
├── vite.config.ts         ← Vite config: vendor stubs + library chunks (see comments)
├── package.json           ← Frontend deps (LOCKED)
├── public/textures/       ← Globe textures: earth-night 1k (first paint) → 2k/4k
├── server/                ← Backend (Express + SQLite + Socket.IO)
│   ├── index.js           ← Server entry (port 3001), rate limits, caching, /r/:id pages
│   ├── routes.js          ← REST endpoints (incl. audio w/ Range, delete-by-token)
│   ├── db.js              ← SQLite setup + migrations (incl. legacy backfill)
│   ├── migrations/        ← legacy-measurements-2026-09.json
│   ├── validation.js      ← Event validation (rounds coords to ~1 km, real audio only)
│   └── package.json       ← Server deps
├── src/
│   ├── main.jsx           ← React entry (ErrorBoundary)
│   ├── App.jsx            ← Shell: data, selection, routing, intro, live feed, post landing
│   ├── components/
│   │   ├── ErrorBoundary.jsx
│   │   ├── Globe/
│   │   │   ├── GlobeCanvas.jsx    ← Globe engine: taps, warm-up, audio-reactive pulse, land()
│   │   │   ├── clusters.js        ← Spots, zoom clustering (spanning tree), petal rings
│   │   │   ├── markers.js         ← One point per fart; split/merge/bloom animation, picking
│   │   │   ├── zoom.js            ← Wheel / pinch / double-tap zoom, anchored under the finger
│   │   │   ├── tiles.js           ← NASA Black Marble close-up tiles (GIBS, fetched at runtime)
│   │   │   ├── labels.js          ← Place names + counts beside markers (DOM, collision-free)
│   │   │   └── camera.js, reticle.js, rings.js, glows.js, look.js (+ coordinate grid), geo.js
│   │   └── HUD/
│   │       ├── instrument/        ← SevenSeg.jsx, VuMeter.jsx (shared instruments)
│   │       ├── HomeControls.jsx   ← Front panel (ALL n / ceramic REC / RANDOM) + hint
│   │       ├── ZoomControls.jsx   ← Zoom rocker (+ / −), whole-Earth key, scale readout
│   │       ├── TopBar.jsx         ← Pilot lamp, wordmark, counters, ⋯ menu
│   │       ├── RecordingList.jsx  ← The log: Newest / Longest / Loudest / Mine
│   │       ├── RecordingCard.jsx  ← The deck (+ deck/*): place, VU, waveform, readings
│   │       ├── WaveformPlayer.jsx ← Ceramic PLAY + phosphor waveform
│   │       ├── RecorderSheet.jsx  ← The field recorder (+ recorder/*: tape, slip, flight)
│   │       ├── Sheet.jsx          ← Drawers (phones) / floating panels (desktop); focus mgmt
│   │       ├── AboutPanel.jsx, Toasts.jsx, Icon.jsx
│   │       ├── AccountControls.jsx ← Clerk sign-in, loaded lazily from the menu
│   │       └── FartTagLab.jsx, FartSommelierSalon.jsx ← side projects (lazy-loaded)
│   ├── data/
│   │   └── recordingsApi.js       ← REST + Socket.IO client
│   ├── utils/
│   │   ├── audioAnalysis.js       ← decode, trim, loudness, YIN pitch, WAV encode
│   │   ├── analysisWorker.js      ← runs the analysis off the main thread
│   │   ├── audioContext.js        ← shared AudioContext, unlocked inside the REC tap
│   │   ├── location.js            ← GPS + network estimate in parallel, place names
│   │   ├── player.js              ← shared <audio> (iOS-safe), windows, currentLevel()
│   │   ├── recordings.js          ← places, sites (merged ~2 km), loudness words, formatting
│   │   ├── sunPhase.js            ← DAY / NIGHT / DAWN / DUSK where and when recorded
│   │   ├── browserEnv.js          ← in-app browser detection (mic escape card)
│   │   └── ownRecordings.js       ← this device's posts + delete tokens (localStorage)
│   ├── vendor-stubs/              ← stand-ins for three/webgpu, three/tsl, h3-js (unused)
│   ├── config/humor.ts            ← old joke copy (used by proposals only)
│   ├── styles/                    ← tokens, base, instrument (primitives), one file per area
│   └── types/                     ← TypeScript type defs (reference only)
├── village/                        ← Andean Village agent monitor
├── _archive/hud-v1/               ← The old mission-control dashboard (not rendered)
└── docs/                          ← Historical docs (COORDINATION.md, etc.)
```

---

## File Ownership Rules (Terrace Boundaries)

**Before editing ANY file, check this table.** If your task touches files outside
your terrace, STOP and tell Mark so he can coordinate through Quipu.

| Area | Owner | Files | Notes |
|------|-------|-------|-------|
| App shell | **Quipu** (shared soil) | `src/App.jsx`, `src/main.jsx`, `index.html` | Coordinate before editing |
| Globe | **Inti** | `src/components/Globe/*` | Visual effects, markers, arcs |
| HUD panels | **Chaska** | `src/components/HUD/*` | Dashboard widgets |
| Data layer | **Wari** | `src/data/*` | REST + live Socket.IO client |
| Styles | **Chaska** | `src/styles/*` | CSS tokens, layouts, animations |
| Config | Shared | `src/config/*` | Constants, city data — ask Quipu |
| Utils | Shared | `src/utils/*` | Pure helper functions — ask Quipu |
| Types | Shared | `src/types/*` | TypeScript definitions — ask Quipu |
| Backend | **Wari** | `server/*` | API, DB, WebSocket |
| Build config | **LOCKED** | `vite.config.ts`, `package.json`, `tsconfig.json` | Quipu only, with Mark's approval |
| CLAUDE.md | **Quipu** | `CLAUDE.md` | Only Quipu edits this file |

---

## Rules for All Claude Instances

### Git Discipline
- **Always pull before starting work**: `git pull` (once we have a remote)
- **Work on feature branches**: `git checkout -b feature/your-task-name`
- **Commit frequently** with clear messages
- **Never force push to main**
- **Check `git status` before and after your work**

### Code Style
- React components: `.jsx` files, function components, hooks
- Utility/config/types: `.ts` files are OK
- CSS: Use existing design tokens from `src/styles/tokens.css`
- No inline styles — use CSS classes
- Descriptive component and variable names

### Task Discipline (from context-mode patterns)
- **Be surgical**: Make the smallest change that accomplishes your task
- **Don't refactor what you weren't asked to refactor**
- **State what you changed** at the end of your session
- **If you see a problem outside your scope**, note it in your response — don't fix it
- **Read before you write**: Always read a file before editing it
- **Test your changes**: Run `npm run dev` and verify nothing broke

### Token Conservation
- Don't re-read files you've already read in this session
- Use targeted grep/glob instead of reading entire directories
- For large files, read only the section you need (use offset/limit)
- Keep responses focused — don't repeat the entire file back

---

## Backend API Reference

**Base URL**: `http://localhost:3001`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/events` | Submit `{lat, lng, country, place, audioData (base64), audioMimeType, duration, volume, peakVolume, intensity, type}` → event + `deleteToken` (returned only to the poster) |
| `GET` | `/api/events?limit=500` | Recent events (max 500), no audio |
| `GET` | `/api/events/:id` | One event (used by shared `/r/:id` links) |
| `GET` | `/api/events/:id/audio` | The audio file — supports Range, cached forever |
| `DELETE` | `/api/events/:id` | Delete with header `X-Delete-Token` (the poster), or `X-Admin-Token` for moderation when the `ADMIN_TOKEN` env var is set (16+ chars) |
| `GET` | `/api/events/range?start=&end=` | Historical range |
| `GET` | `/api/stats` | Aggregates: totalToday, totalAllTime, etc. |
| `GET` | `/api/health` | Health check |
| `GET` | `/r/:id` | (production) index.html with the recording's preview tags, `window.__FATW_SHARED__` and an audio preload |

**WebSocket** (Socket.IO on same port):
- `fart:new` — single new event
- `fart:deleted` — `{ id }` when a poster deletes theirs
- `fart:burst` — batch of events
- (no periodic `stats:update` any more — nothing listened to it)

Rate limits per IP per minute: 10 posts, 120 other API calls, 600 audio files.

---

## Known Issues & Next Steps

### Open (as of 2026-09-25)
- [ ] Test on a real iPhone + Android phone: one-tap recording, audio session,
      in-app browsers, haptics, safe areas (all verified only in headless Chrome
      with a simulated mic)
- [ ] Two placeholder test rows (<1 KB of "audio") are hidden from the API but
      still in the DB — delete with `X-Admin-Token` once `ADMIN_TOKEN` is set
- [ ] Clerk runs on a development key in production; sign-in is optional and now
      loads only from the menu — use a production instance or remove the keys
- [ ] Big phones held sideways (wider than 859 px) get the desktop layout
- [ ] Close-up imagery comes live from NASA GIBS (no key; tiles aren't
      cacheable, so each visit re-downloads them — proxy through the server if
      traffic grows). If GIBS is down the globe keeps its own texture.
- [ ] Moderation: anyone can post; only the poster's device can delete

### Done on 2026-09-25 (potato round)
- [x] World tour (menu): flies to every fart in a shuffled order, down to its
      petal, plays it on arrival, moves on when it ends; any touch/key stops it
- [x] Live arrivals in view fall in as comets (like your own posts)
- [x] Potato Propaganda layer (keep it, add to it, keep it subtle): the planet
      turns out to be a potato (type "potato", tap the wordmark 5×, or the
      About credit); "potato country" whispers over Idaho, PEI and the Andes;
      potato nicknames (Small Fry, Tater Tot, Couch Potato); "Planted." toast;
      slip microprint; a console potato; a rare splash tagline

### Done on 2026-09-25 (deep zoom)
- [x] Zoom from orbit to ~12 km (was stuck at ~1,400 km): wheel/trackpad toward
      the cursor, pinch-and-pan, double tap in, two-finger tap out, +/− keys
      and a zoom rocker with a whole-Earth key and a scale readout
- [x] Markers cluster by zoom and split apart as you go in; farts at the same
      spot open into petals (one per fart, clockwise from 12 in the order they
      were made, like the deck's numbered keys); tapping a cluster plays its
      newest fart and flies in until it opens
- [x] Sharp NASA night lights up close, a lat/long grid (1° → 0.01°), and
      place names + counts beside the markers

### Done on 2026-09-25 ("Phosphor & Needle" redesign)
- [x] New design system (three materials, three lights), no glass, no emoji
- [x] One-tap recording, lamp test, seven-segment countdown, VU meter, take slip,
      slip flight + comet landing; takes can't be lost to stray taps
- [x] Globe: sodium/teal Earth, crisp phosphor dots, lock-on reticle, screen-space
      tap picking, audio-reactive pulse, great-circle camera, warm-up intro
- [x] Deck + log rebuilt; shared links open on a title card with PLAY
- [x] First load ~36% lighter (vendor stubs + chunks), no Clerk redirects,
      immutable asset caching, analysis in a worker
- [x] Older recordings backfilled with real length, loudness and place names

### Done on 2026-09-23 (core rebuild)
- [x] Live backend wired end to end (REST + Socket.IO), no mock data
- [x] Recorder rebuilt (countdown, trim, WAV, real stats, GPS + network fallback)
- [x] Globe shows every recording, not just the last 90 seconds
- [x] Shareable `/r/:id` links with link previews; delete-your-own
- [x] Old dashboard archived to `_archive/hud-v1/`

### Cleanup (done on 2026-02-23)
- [x] Initialized git repo
- [x] Removed duplicate `vite.config.js` (keeping `.ts` only)
- [x] Archived 7 orphaned TypeScript components to `_archive/`
- [x] Created this CLAUDE.md

### Future Enhancements
- [ ] Per-recording share images (og:image) — the take slip is a natural one

---

## Design System — "Phosphor & Needle" (Reference)

The site is a precise piece of night-time recording hardware that treats real
farts with total seriousness. Tokens live in `src/styles/tokens.css`, shared
primitives in `src/styles/instrument.css` and `src/components/HUD/instrument/`.

- **Three materials**: black anodized chassis (`.chassis`, dark `.key`s) · cream
  ceramic (`.key-ceramic`, ONLY for REC, PLAY, POST) · backlit paper (VU face and
  take slip only).
- **Three lights**: phosphor `#62F6D0` (readouts, farts on the globe, waveforms) ·
  sodium `#FFA537` (city lights, countdown, fresh farts, warnings) · tally
  `#FF3D2E` (recording only). Lit things live in recessed `.well`s.
- **Type**: Michroma (wordmark + plate titles only), B612 (UI and every number),
  B612 Mono (receipts/metadata), Doto (dot-matrix lines, ≥14 px), seven-segment
  SVG digits (`SevenSeg`).
- **Motion**: keys travel and latch; drawers spring (`--spring-*` linear()
  curves); electronics switch on instantly and decay off. No glass, no emoji,
  no invented jargon — only real measurements, plainly worded.
- **Potato Propaganda**: the site is a Potato Propaganda production. Potato
  easter eggs and very subtle potato innuendo are welcome anywhere they fit
  (see the potato round above) — never loud, never in the way of the core flows.
- **The globe up close**: NASA night lights in the same sodium/teal, a fine
  phosphor lat/long grid (recordings are rounded to 0.01°, so every dot sits on
  a crossing of the finest one), names printed in the legend face, and shared
  spots as petal rings on hairlines around a pin.

The old side projects keep their own palette (`--bg-*`, `--accent-*` tokens).

---

## How to Run

```bash
# Frontend only (mock data)
npm install
npm run dev              # → http://localhost:5173

# Backend
cd server && npm install
node index.js            # → http://localhost:3001

# Both (use two terminals or the .claude/launch.json configs)
```

---

## For the Human (Mark) — Quipu Protocol

You are the Inca emperor's human advisor. Here's how to run the empire:

### Launching a Thread
1. Open a new Claude Code session in this project directory
2. It will auto-read this CLAUDE.md and know the whole system
3. Tell it: **who it is**, **what to do**, and **what files to touch**
4. Have it create a **git branch** (`git checkout -b feature/task-name`)

### Example Commands
- *"You are Inti. Add selective bloom to epic fart events on the globe. Only edit `src/components/Globe/`. Branch: `feature/epic-bloom`."*
- *"You are Chaska. Make the EventFeed auto-scroll smoothly. Only edit `src/components/HUD/EventFeed.jsx` and `src/styles/`. Branch: `feature/smooth-scroll`."*
- *"You are Wari. Add `socket.io-client` and wire up the live backend connection. Edit `src/data/` and `server/`. Coordinate with Quipu for any App.jsx changes. Branch: `feature/live-backend`."*

### Anti-Chaos Rules
- **One thread per feature, one feature per thread**
- **No thread edits App.jsx or package.json** without your approval
- **If two threads need the same file**, they work sequentially — never in parallel
- **When in doubt**, ask Quipu (this coordinating thread) to plan the approach
- **Chasqui (Codex)** gets self-contained tasks only — include all context in the prompt

### Consulting Spudnik
When you need vision/direction/philosophy, ask Spudnik on Claude Web.
Spudnik doesn't touch code. Spudnik decrees. The builders build.
