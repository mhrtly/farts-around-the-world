# GFMS — Global Flatulence Monitoring System — Architecture

> This document is the **shared contract** between all Claude instances working on this project.
> If you're a Claude working on any part of this app, READ THIS FIRST and update it when you make architectural decisions.

---

## Current State (2026-02-23)

The project is being rebuilt by 4 Claude instances in parallel:

| Claude | Responsibility | Status |
|--------|---------------|--------|
| **Backend Claude** (me) | Server, API, WebSocket, data persistence, submission form | Building `server/` directory |
| **Frontend Claude 1** | ? (please document what you're building) | Unknown |
| **Frontend Claude 2** | ? (please document what you're building) | Unknown |
| **Frontend Claude 3** | ? (please document what you're building) | Unknown |

### Stack Decisions Made So Far
- **Language**: TypeScript (vanilla, no React)
- **Map**: MapLibre GL + deck.gl
- **State**: Zustand
- **Client persistence**: idb-keyval (IndexedDB)
- **Clustering**: supercluster
- **Data viz**: d3 (full)
- **Build**: Vite 6 + TypeScript 5.7
- **Boot sequence**: Done in index.html (pure HTML/CSS)

---

## CANONICAL EVENT SCHEMA

**This is the single source of truth for fart event data.** All components (server, client, visualizations) must use this shape.

```typescript
interface FartEvent {
  id: string            // UUID, generated server-side
  lat: number           // -90 to 90
  lng: number           // -180 to 180
  intensity: number     // integer 1-10
  country: string       // ISO 3166-1 alpha-2 (e.g. "US", "GB", "JP")
  timestamp: number     // epoch milliseconds, generated server-side
  type: 'standard' | 'epic' | 'silent-but-deadly'
}
```

**Supported countries** (20):
`US, GB, DE, FR, JP, CN, BR, IN, AU, CA, MX, RU, NG, ZA, EG, AR, KR, ID, TR, IT`

---

## BACKEND API (port 3001)

### REST Endpoints

| Method | Path | Body / Params | Response | Description |
|--------|------|---------------|----------|-------------|
| `POST` | `/api/events` | `{ lat, lng, intensity, country, type }` | `201 { event }` | Submit a fart. Server generates `id` and `timestamp`. |
| `GET` | `/api/events` | `?limit=200` (max 500) | `[FartEvent, ...]` | Recent events, newest first. |
| `GET` | `/api/events/range` | `?start=<epoch>&end=<epoch>` | `[FartEvent, ...]` | Historical range query. |
| `GET` | `/api/stats` | — | `{ totalToday, totalAllTime, topCountry, eventsByType }` | Aggregate statistics. |
| `GET` | `/api/health` | — | `{ status, uptime, eventCount }` | Health check. |

### WebSocket (Socket.IO)

Connect to `ws://localhost:3001` (or production URL).

**Server → Client events:**

| Event | Payload | Description |
|-------|---------|-------------|
| `fart:new` | `FartEvent` | Single new event, broadcast immediately on submission |
| `fart:burst` | `FartEvent[]` | Batch of events (future: for bulk imports) |
| `stats:update` | `{ totalToday, topCountry, eventsPerMinute }` | Pushed every 5 seconds |

**Client → Server:** Clients are listeners only. Submissions go through REST `POST /api/events`.

### Rate Limiting
- `POST /api/events`: 30 requests per minute per IP
- `GET` endpoints: 120 requests per minute per IP

---

## FRONTEND → BACKEND INTEGRATION

### How to connect (for frontend Claudes)

1. **Add `socket.io-client` to root package.json** (I'll do this)
2. **Import and use:**

```typescript
import { io } from 'socket.io-client'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const socket = io(API_URL)

// Listen for new events
socket.on('fart:new', (event: FartEvent) => {
  // Feed into your Zustand store
})

// Load initial events on connect
socket.on('connect', async () => {
  const res = await fetch(`${API_URL}/api/events?limit=200`)
  const events: FartEvent[] = await res.json()
  // Populate your store with historical data
})
```

3. **Vite proxy is configured** so during dev you can also use relative URLs:
   - `fetch('/api/events')` instead of `fetch('http://localhost:3001/api/events')`

### I'm providing these files for you:
- `src/data/liveFartStream.ts` — WebSocket stream that emits events via callback
- `src/data/apiClient.ts` — typed fetch helpers for all REST endpoints

You can either use these directly or adapt them to your Zustand store pattern.

---

## QUESTIONS FOR OTHER CLAUDES

Please answer these by editing this section (replace the ??? with your answers):

1. **Zustand store shape**: What does the main store look like? What actions/selectors exist?
   - Answer: ???

2. **Routing**: Is there a router? How should the submission page (`/submit`) be handled?
   - Answer: ???

3. **CSS approach**: Are you using CSS modules, a global stylesheet, Tailwind, or something else?
   - Answer: ???

4. **Component structure**: What's the planned component tree? Where does real-time event data flow in?
   - Answer: ???

5. **MapLibre setup**: Is the map component expecting to receive events as props, from a store, or via direct subscription?
   - Answer: ???

---

## FILE OWNERSHIP

To avoid conflicts, each Claude should only modify files in their area:

| Area | Owner | Files/Directories |
|------|-------|-------------------|
| Server | Backend Claude | `server/*` |
| Client data layer | Backend Claude | `src/data/*` |
| Dev config | Backend Claude | `vite.config.ts` (proxy only), `.env*`, root `package.json` (deps only) |
| Map/Globe | Frontend Claude ? | `src/components/Globe/*` or equivalent |
| HUD/Dashboard | Frontend Claude ? | `src/components/HUD/*` or equivalent |
| Styles | Frontend Claude ? | `src/styles/*` or equivalent |
| App shell | Frontend Claude ? | `src/main.ts`, `src/App.ts`, `index.html` |
| Boot sequence | Done | `index.html` (already built) |

---

## RUNNING THE PROJECT

```bash
# Install frontend deps
npm install

# Install server deps
cd server && npm install && cd ..

# Run both (after setup)
npm run dev:all
# Or separately:
npm run dev          # Vite frontend on :5173
npm run dev:server   # API server on :3001
```
