# CLAUDE.md — Farts Around The World App

> **Every Claude Code instance working in this repo MUST read and follow this file.**
> This is the single source of truth. COORDINATION.md and ARCHITECTURE.md are historical
> artifacts from the chaotic multi-agent bootstrap phase — they contain outdated/conflicting
> info. THIS file supersedes them.

---

## Project Overview

**Global Flatulence Monitoring System (GFMS)** — a real-time 3D globe visualization
with a sci-fi mission control HUD that tracks "fart events" worldwide. Crowdsourced
global flatulence intelligence with an OSINT war-room aesthetic.

**Status**: MVP demo is functional. Globe + HUD + mock data stream all work.
Backend API is built but not yet wired to frontend.

---

## Stack (LOCKED — Do Not Change)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | React 18 (JSX) | No TypeScript components — all `.jsx` |
| Globe | `globe.gl` + `three-globe` + Three.js | 3D visualization |
| Bundler | Vite 6 | Config in `vite.config.ts` only |
| Styling | CSS custom properties + glassmorphism | 10 CSS files in `src/styles/` |
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
// FartEvent — the ONLY shape all code should use
{
  id: string,          // UUID, server-generated
  lat: number,         // -90 to 90
  lng: number,         // -180 to 180
  intensity: number,   // 1-10
  country: string,     // ISO 3166-1 alpha-2
  timestamp: number,   // epoch ms, server-generated
  type: 'standard' | 'epic' | 'silent-but-deadly'
}
```

**20 supported countries:**
`US, GB, DE, FR, JP, CN, BR, IN, AU, CA, MX, RU, NG, ZA, EG, AR, KR, ID, TR, IT`

---

## Project Structure

```
/
├── CLAUDE.md              ← YOU ARE HERE (single source of truth)
├── index.html             ← Boot screen + React mount
├── vite.config.ts         ← Vite config (ONLY config — no .js duplicate)
├── package.json           ← Frontend deps (LOCKED)
├── server/                ← Backend (Express + SQLite + Socket.IO)
│   ├── index.js           ← Server entry (port 3001)
│   ├── routes.js          ← REST endpoints
│   ├── db.js              ← SQLite setup
│   ├── validation.js      ← Event validation
│   └── package.json       ← Server deps
├── src/
│   ├── main.jsx           ← React entry
│   ├── App.jsx            ← Root component + state + event stream
│   ├── components/
│   │   ├── Globe/
│   │   │   └── GlobeCanvas.jsx    ← 3D globe (arcs, rings, heatmap)
│   │   └── HUD/
│   │       ├── Header.jsx         ← Title bar + UTC clock
│   │       ├── KPIPanel.jsx       ← Telemetry cards
│   │       ├── Leaderboard.jsx    ← Top 5 countries
│   │       ├── EventFeed.jsx      ← Scrolling event list
│   │       ├── Timeline.jsx       ← 60-second histogram
│   │       ├── EpicAlert.jsx      ← Alert overlay for epic/SBD
│   │       ├── GasconIndicator.jsx ← Threat level + EPM
│   │       ├── MethaneWaveform.jsx ← Canvas waveform
│   │       └── AnimatedNumber.jsx  ← Number roll animation
│   ├── data/
│   │   ├── mockFartStream.js      ← Random event generator (dev)
│   │   ├── liveFartStream.ts      ← Socket.IO client (NOT YET CONNECTED)
│   │   └── apiClient.ts           ← REST helpers (NOT YET CONNECTED)
│   │   └── aggregator.js          ← Timeline/leaderboard utils
│   ├── config/                    ← Constants, cities, humor strings
│   ├── styles/                    ← All CSS (tokens, app, animations, etc.)
│   ├── types/                     ← TypeScript type defs (reference only)
│   └── utils/                     ← Formatting, color, time helpers
├── _archive/                      ← Dead code from chaotic bootstrap phase
└── docs/                          ← Historical docs (COORDINATION.md, etc.)
```

---

## File Ownership Rules

**Before editing ANY file, check this table.** If your task touches files outside
your assigned area, STOP and tell the user so they can coordinate.

| Area | Files | Notes |
|------|-------|-------|
| App shell | `src/App.jsx`, `src/main.jsx`, `index.html` | Central — coordinate before editing |
| Globe | `src/components/Globe/*` | Visual effects, markers, arcs |
| HUD panels | `src/components/HUD/*` | Dashboard widgets |
| Data layer | `src/data/*` | Mock stream, live stream, API client |
| Styles | `src/styles/*` | CSS tokens, layouts, animations |
| Config | `src/config/*` | Constants, city data |
| Utils | `src/utils/*` | Pure helper functions |
| Types | `src/types/*` | TypeScript definitions |
| Backend | `server/*` | API, DB, WebSocket |
| Build config | `vite.config.ts`, `package.json`, `tsconfig.json` | LOCKED — ask first |

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
| `POST` | `/api/events` | Submit event `{lat, lng, intensity, country, type}` |
| `GET` | `/api/events?limit=200` | Recent events (max 500) |
| `GET` | `/api/events/range?start=&end=` | Historical range |
| `GET` | `/api/stats` | Aggregates: totalToday, topCountry, etc. |
| `GET` | `/api/health` | Health check |

**WebSocket** (Socket.IO on same port):
- `fart:new` — single new event
- `fart:burst` — batch of events
- `stats:update` — pushed every 5s

---

## Known Issues & Next Steps

### Immediate (must fix)
- [ ] Frontend uses mock data only — wire up `liveFartStream.ts` to App.jsx
- [ ] `socket.io-client` not in package.json yet
- [ ] No routing — need React Router for submission page

### Cleanup (done on 2026-02-23)
- [x] Initialized git repo
- [x] Removed duplicate `vite.config.js` (keeping `.ts` only)
- [x] Archived 7 orphaned TypeScript components to `_archive/`
- [x] Created this CLAUDE.md

### Future Enhancements
- [ ] Three.js UnrealBloomPass for glow effects on globe
- [ ] Motion.js for smooth panel animations
- [ ] Submission form UI (POST to backend)
- [ ] Mobile responsive layout
- [ ] Quality levels (High/Medium/Low) for performance

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

## For the Human (Mark)

When launching a new Claude Code thread for this project:
1. Claude will auto-read this CLAUDE.md
2. Give each thread a **specific, scoped task** (e.g., "Add bloom effects to GlobeCanvas.jsx only")
3. Tell them which files they're allowed to edit
4. Have them work on a **git branch** (`git checkout -b feature/task-name`)
5. Review and merge branches yourself, or have one lead thread do it

**Anti-chaos rules:**
- One thread per feature, one feature per thread
- No thread should edit `App.jsx` or `package.json` without your approval
- If two threads need to touch the same file, they must work sequentially, not in parallel
