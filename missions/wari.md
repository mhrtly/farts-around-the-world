# Mission Orders: WARI — Terrace Builder, Backend Engineer

> You are **Wari**. Read CLAUDE.md first, then follow these orders.

---

## Your Identity

Named for the pre-Inca Wari civilization, master terrace-farmers and
infrastructure builders. You lay the stone terraces (database), dig the
irrigation channels (API routes), and keep the water flowing (WebSocket).

## Your Terrace

**Files you may edit:**
- `server/*`
- `src/data/*`
- New files in those directories as needed

**Files you must NOT edit:** `src/App.jsx`, `src/components/*`, `src/styles/*`.
If your work requires changes to App.jsx (it will — see below), document
exactly what needs to change and tell Mark. He'll make the edit or have
Quipu do it.

## Branch

```bash
git checkout -b feature/wari-live-connection
```

---

## Mission: Connect the Irrigation Channels

The backend is fully built (Express + SQLite + Socket.IO on port 3001).
The frontend exists but runs entirely on mock data. Your mission is to
**connect them** so real events flow through the system.

### Task 1: Add socket.io-client — HIGH PRIORITY

The frontend needs `socket.io-client` to connect to the backend WebSocket.
It's not in package.json yet.

**What to do:**
1. Run `npm install socket.io-client` in the project root
2. This will modify `package.json` and `package-lock.json` — that's expected
   and approved for this specific dependency
3. Verify `liveFartStream.ts` already imports from `socket.io-client` (it does)

### Task 2: Create a Unified Stream Switcher — HIGH PRIORITY

Right now `App.jsx` hardcodes `createFartStream` (mock). We need a wrapper
that can use either mock OR live data depending on whether the backend is
available.

**Create `src/data/fartStreamFactory.js`:**
```js
import { createFartStream } from './mockFartStream.js'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

/**
 * Tries to connect to the live backend. Falls back to mock data
 * if the server isn't running.
 */
export async function createStream(onEvent) {
  try {
    const health = await fetch(`${API_URL}/api/health`, {
      signal: AbortSignal.timeout(2000)
    })
    if (health.ok) {
      // Dynamic import so socket.io-client isn't bundled if unused
      const { createLiveFartStream } = await import('./liveFartStream.ts')
      console.log('[GFMS] Backend detected — using live data stream')
      return createLiveFartStream({ onEvent })
    }
  } catch {
    // Backend not available — fall through to mock
  }

  console.log('[GFMS] Backend not available — using mock data stream')
  return createFartStream(onEvent)
}
```

**Then tell Mark that App.jsx needs this change:**

The current App.jsx useEffect (line 39-42):
```js
useEffect(() => {
  streamRef.current = createFartStream(handleNewEvent)
  return () => streamRef.current?.stop()
}, [handleNewEvent])
```

Needs to become:
```js
useEffect(() => {
  let cancelled = false
  createStream(handleNewEvent).then(stream => {
    if (cancelled) { stream.stop(); return }
    streamRef.current = stream
  })
  return () => { cancelled = true; streamRef.current?.stop() }
}, [handleNewEvent])
```

And the import changes from:
```js
import { createFartStream } from './data/mockFartStream.js'
```
to:
```js
import { createStream } from './data/fartStreamFactory.js'
```

**Document this exact change clearly in your summary so Mark/Quipu can apply it.**

### Task 3: Build the Submission Form — MEDIUM PRIORITY

Create a fart submission component. This is the "upload experience" —
filing an intelligence report.

**Create `src/components/HUD/SubmitPanel.jsx`:**

A panel that lives in the right sidebar (Chaska will style it, you just
build the functional component). It should:

1. Show a "FILE REPORT" button that expands the form
2. Form fields:
   - **Location**: Auto-detect via browser geolocation API, with manual
     lat/lng override
   - **Intensity**: Slider 1-10 with labels ("Whisper" to "Catastrophic")
   - **Type**: Radio buttons — Standard / Epic / Silent But Deadly
   - **Country**: Auto-detect from coordinates or manual select
3. On submit:
   - POST to `${API_URL}/api/events` with `{ lat, lng, intensity, country, type }`
   - Show a dramatic "ANALYZING..." progress sequence:
     `"TRIANGULATING COORDINATES..."` → `"CLASSIFYING EMISSION..."` →
     `"FILING REPORT..."` → `"CONFIRMED"`
   - The backend generates `id` and `timestamp` server-side
   - The event will automatically appear on the globe via WebSocket broadcast
4. Keep the styling minimal — use existing CSS classes from `src/styles/forms.css`
   and panel styling. Chaska will polish it later.

**API reference:**
```
POST /api/events
Body: { lat: number, lng: number, intensity: number, country: string, type: string }
Response: 201 { event: FartEvent }
```

### Task 4: Verify Backend Stability — LOW PRIORITY

Run the backend and verify:
- `node server/index.js` starts without errors on port 3001
- POST to `/api/events` creates events and broadcasts via WebSocket
- GET `/api/events` returns them
- GET `/api/stats` returns aggregates
- Fix any issues you find

---

## What NOT to Do

- Don't implement dietary intelligence, wetness coefficient, or similarity
  matching yet — those are Phase 2 features that Spudnik has envisioned
  but we need the basic pipeline working first
- Don't modify App.jsx yourself — document the changes needed
- Don't touch Globe or HUD components (those are Inti's and Chaska's terraces)
- Don't add unnecessary dependencies beyond `socket.io-client`

## How to Test

```bash
# Terminal 1: Backend
cd server && npm install && node index.js

# Terminal 2: Frontend
npm install    # (after adding socket.io-client)
npm run dev
```

With both running, the frontend should auto-detect the backend and switch
to live data. Without the backend, it should gracefully fall back to mock data.

Test the submission by POSTing via curl:
```bash
curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{"lat": 48.85, "lng": 2.35, "intensity": 7, "country": "FR", "type": "epic"}'
```

The event should appear on the globe within 1 second.

## When You're Done

1. Commit your changes on your branch
2. Tell Mark exactly what App.jsx changes are needed (copy-paste the diff)
3. Note: "socket.io-client has been added to package.json"
4. List any issues found in the backend
