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
   list), hear it. Shareable `/r/:id` links.

Real, and funny because it's real — no fictional "intelligence agency" copy.
The old mission-control dashboard lives in `_archive/hud-v1/`.

**Status (2026-09-23)**: Core rebuilt on `feature/core-polish` — live backend,
real-time updates over Socket.IO, desktop + mobile layouts. Side projects
(Archive Lab, Sommelier Salon) sit behind the ⋯ menu.

---

## Stack (LOCKED — Do Not Change)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | React 18 (JSX) | No TypeScript components — all `.jsx` |
| Globe | `globe.gl` + `three-globe` + Three.js | 3D visualization |
| Bundler | Vite 6 | Config in `vite.config.ts` only |
| Styling | CSS custom properties + glassmorphism | Core UI in `src/styles/home.css` |
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
  place: string | null,  // "Grand Canyon Village, Arizona" (older rows: null)
  timestamp: number,     // epoch ms, server-generated
  duration: number,      // seconds of actual sound (older rows: whole clip length)
  volume: number | null,     // mean RMS × 100 of the sound (older rows: null)
  peakVolume: number | null, // peak RMS × 100
  intensity: number,     // 1-10, derived from loudness
  type: 'standard' | 'epic' | 'silent-but-deadly',  // derived from length/loudness
  audioMimeType: string, // 'audio/wav' for new posts; older rows webm/opus
  hasAudio: 1
}
```

Audio is served from `GET /api/events/:id/audio`. Pitch is not stored — the
client measures it (and the waveform) when a recording is opened.

---

## Project Structure

```
/
├── CLAUDE.md              ← YOU ARE HERE (single source of truth)
├── index.html             ← Fast splash (hides on `fatw:ready`) + React mount + meta
├── vite.config.ts         ← Vite config (ONLY config — no .js duplicate)
├── package.json           ← Frontend deps (LOCKED)
├── public/textures/       ← Self-hosted globe textures (earth-night 2k/4k)
├── server/                ← Backend (Express + SQLite + Socket.IO)
│   ├── index.js           ← Server entry (port 3001), /r/:id link previews
│   ├── routes.js          ← REST endpoints (incl. audio w/ Range, delete-by-token)
│   ├── db.js              ← SQLite setup + migrations
│   ├── validation.js      ← Event validation (rounds coords to ~1 km)
│   └── package.json       ← Server deps
├── src/
│   ├── main.jsx           ← React entry (ErrorBoundary; ClerkProvider only if key set)
│   ├── App.jsx            ← Shell: data, selection, routing, live feed, layout
│   ├── components/
│   │   ├── ErrorBoundary.jsx
│   │   ├── Globe/
│   │   │   └── GlobeCanvas.jsx    ← Globe: one marker per place, pulses, puffs, fly-to
│   │   └── HUD/
│   │       ├── TopBar.jsx         ← Brand, live stats, ⋯ menu
│   │       ├── RecordingList.jsx  ← Latest / Longest / Loudest / Mine
│   │       ├── RecordingCard.jsx  ← Selected fart: player, stats, share, delete
│   │       ├── WaveformPlayer.jsx ← Play button + real waveform
│   │       ├── RecorderSheet.jsx  ← Record → review → post
│   │       ├── Sheet.jsx          ← Bottom sheet (mobile) / floating panel (desktop)
│   │       ├── AboutPanel.jsx, Toasts.jsx, Icon.jsx, AccountControls.jsx (Clerk)
│   │       └── FartTagLab.jsx, FartSommelierSalon.jsx ← side projects (lazy-loaded)
│   ├── data/
│   │   └── recordingsApi.js       ← REST + Socket.IO client
│   ├── utils/
│   │   ├── audioAnalysis.js       ← decode, trim, loudness, YIN pitch, WAV encode
│   │   ├── location.js            ← GPS → network fallback, place names (BigDataCloud)
│   │   ├── player.js              ← single shared <audio> (iOS-safe), playback window
│   │   ├── recordings.js          ← places, flags, sites, formatting, nicknames
│   │   └── ownRecordings.js       ← this device's posts + delete tokens (localStorage)
│   ├── config/humor.ts            ← old joke copy (used by proposals only)
│   ├── styles/                    ← tokens.css, app.css (base), home.css (core UI)
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
| `DELETE` | `/api/events/:id` | Delete with header `X-Delete-Token` (poster only) |
| `GET` | `/api/events/range?start=&end=` | Historical range |
| `GET` | `/api/stats` | Aggregates: totalToday, totalAllTime, etc. |
| `GET` | `/api/health` | Health check |
| `GET` | `/r/:id` | (production) index.html with a per-recording link-preview title |

**WebSocket** (Socket.IO on same port):
- `fart:new` — single new event
- `fart:deleted` — `{ id }` when a poster deletes theirs
- `fart:burst` — batch of events
- `stats:update` — pushed every 5s

---

## Known Issues & Next Steps

### Open (as of 2026-09-23)
- [ ] Test the recorder on a real iPhone + Android phone (built for iOS gesture
      rules; verified in desktop Chrome with a simulated mic)
- [ ] Older recordings (pre-rebuild) have no `place`/`volume`; the client looks
      places up lazily and measures loudness/pitch on open
- [ ] Moderation: anyone can post; only the poster's device can delete

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
- [ ] Per-recording share images (og:image) for richer link previews
- [ ] Split three.js/globe.gl into a cached vendor chunk (main bundle ~575 KB gzip)
- [ ] One-time place-name backfill for older recordings

---

## Design Tokens (Reference)

```css
--bg-0: #06090d          /* Darkest background */
--bg-1: #0b1118
--bg-2: #0f1a26
--panel-glass: rgba(16,26,38,0.42)
--accent-cyan: #38f3ff   /* Primary data color */
--accent-lime: #9dff4a   /* SBD events */
--accent-pink: #ff64ff   /* Epic events */
--accent-amber: #ffb020  /* Warnings */
--accent-red: #ff4d5a    /* Critical alerts */
```

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
