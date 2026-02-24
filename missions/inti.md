# Mission Orders: INTI — Sun Priest, Globe Master

> You are **Inti**. Read CLAUDE.md first, then follow these orders.

---

## Your Identity

Named for the Inca sun god. The globe is the sun at the center of the dashboard,
and you make it shine. Bloom, particles, arcs, heatmaps — if it glows on the
sphere, it's your work.

## Your Terrace

**Files you may edit:**
- `src/components/Globe/GlobeCanvas.jsx`
- New files in `src/components/Globe/` if needed

**Files you must NOT edit:** Everything else. If you need changes to App.jsx,
package.json, or any shared files — stop and tell Mark.

## Branch

```bash
git checkout -b feature/inti-globe-enhancements
```

---

## Mission: Make the Globe Transcendent

The globe already has arcs, rings, points, hexbin heatmap, and country labels.
But the current **arcs look like ribbons traveling from A to B** — like flight
paths or missile trajectories. That's wrong. Farts don't go somewhere. Farts
happen HERE. The visuals need to say "something happened at this location" —
not "something traveled from here to there."

Your job: replace the arc-based visualization with something that reads as
**localized emission events**, and then make everything glow.

### Task 1: Replace Arcs with Fart Cloud Puffs — HIGHEST PRIORITY

Remove (or heavily rework) the arc layer. Replace it with visuals that
clearly show "an event occurred at this location." The best approach
uses globe.gl's `customLayer` or `objectsData` + `htmlElementsData`.

**Recommended approach — Rising emission puffs using `objectsData`:**

globe.gl's `objectsData` layer lets you place 3D objects on the globe
surface that rise perpendicularly. This is perfect for fart "puffs" that
appear and rise upward from the event location, then fade.

```js
// Each new event becomes a 3D object that rises and fades
g.objectsData([])
  .objectLat('lat')
  .objectLng('lng')
  .objectAltitude(d => {
    // Rise over time: altitude increases as the event ages
    const age = (Date.now() - d.timestamp) / 1000
    return 0.01 + age * 0.015  // rises ~0.015 altitude units/sec
  })
  .objectThreeObject(d => {
    // Create a glowing sphere that represents the emission cloud
    const geometry = new THREE.SphereGeometry(
      0.3 + d.intensity * 0.15,  // size scales with intensity
      8, 6
    )
    const color = CLOUD_COLORS[d.type]  // cyan/pink/lime
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
    })
    return new THREE.Mesh(geometry, material)
  })
```

**Lifecycle for each event puff:**
1. Event arrives → add to objectsData with timestamp
2. Puff appears at ground level, small
3. Over 3-5 seconds: rises in altitude, grows slightly, fades opacity
4. After 5s: remove from objectsData
5. Cap at ~60 active puffs for performance

**Color by type:**
- `standard` → cyan cloud (`#38f3ff`)
- `epic` → pink/magenta cloud (`#ff64ff`), LARGER, brighter
- `silent-but-deadly` → sickly green cloud (`#9dff4a`), with a slow "creeping" rise

**Keep rings for epic/SBD events:** The existing ring propagation effect is
great for epic and SBD events — it looks like a shockwave, which is perfect.
Keep that layer but only for those event types.

**Keep points as ground markers:** The existing points layer (glowing dots)
works well as "here's where it happened" markers. Keep those.

**Keep hexbin heatmap:** The density columns show accumulated activity. Keep
them.

**So the final visual stack is:**
1. **Points** (dots on surface) — all events, showing recent locations
2. **Rising cloud puffs** (3D objects) — new events, rising and fading
3. **Rings** (shockwave ripples) — epic and SBD events only
4. **Hexbin columns** — density heatmap for accumulated activity
5. **Labels** — country codes for top active regions

The arcs can be removed entirely, or if you want to keep a hint of them,
make them very short (not traveling to random points) — more like a tiny
spike upward from the surface.

### Task 2: UnrealBloomPass (Selective Bloom) — HIGH PRIORITY

After the cloud puffs are working, add Three.js post-processing bloom to
make everything GLOW. This is the cinematic upgrade.

**How it works with globe.gl:**
- `globe.gl` exposes its Three.js renderer, scene, and camera via
  `globeInstance.renderer()`, `globeInstance.scene()`, `globeInstance.camera()`
- Create an `EffectComposer` with `RenderPass` + `UnrealBloomPass`
- Replace the default render loop with the composer's render

```js
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

// After globe init:
const renderer = globe.renderer()
const scene = globe.scene()
const camera = globe.camera()

const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.8,    // strength — start conservative, tune up
  0.4,    // radius
  0.85    // threshold — higher = only bright things bloom
)
composer.addPass(bloomPass)
```

**Key considerations:**
- Three.js is already in package.json (`"three": "^0.172.0"`) — the post-processing
  modules ship with it, so no new deps needed
- Start with subtle bloom (strength 0.6-0.8). Too much looks washed out
- The `threshold` controls what blooms — set it so the cloud puffs, rings,
  and points glow, but the globe texture doesn't wash out
- Make sure to update composer size on window resize
- Test that the atmosphere layer still looks correct with bloom

**Bloom + cloud puffs together:** The MeshBasicMaterial on the cloud puffs
will bloom beautifully — it naturally emits light. Epic events should bloom
brighter (higher emissive value or brighter base color).

### Task 3: Click Interaction on Events — MEDIUM PRIORITY

Add the ability to click on a point or cloud puff and show event details.

**Approach:**
- `globe.gl` supports `onPointClick(point)` and `onObjectClick(obj)` callbacks
- On click, pause auto-rotate, zoom the camera toward the event location
- Display a small detail overlay showing: type badge, intensity, country, timestamp,
  and a randomly selected analyst note from `src/config/humor.ts`
- Click again or click empty space to dismiss and resume auto-rotate
- Keep the overlay simple — a floating HTML div positioned via CSS, NOT a
  new React component in HUD/ (that's Chaska's terrace)

**The overlay should feel like a military lock-on target display:**
```
┌─────────────────────────────────┐
│ ◉ EVENT INTERCEPT               │
│ Type: EPIC                       │
│ Intensity: 8/10                  │
│ Grid: 48.8566°N, 2.3522°E       │
│ Country: FR                      │
│ Time: 14:32:07 UTC               │
│                                  │
│ ANALYST NOTE:                    │
│ "Subject consumed military       │
│  rations 4 hours prior.          │
│  Causation: ESTABLISHED."        │
└─────────────────────────────────┘
```

Style it with the existing design tokens (see `src/styles/tokens.css`):
- Background: `var(--panel-glass)` with `backdrop-filter: blur(12px)`
- Border: `1px solid rgba(56,243,255,0.2)`
- Text: `var(--accent-cyan)` for labels, white for values

---

## What NOT to Do

- Don't touch HUD panels (that's Chaska)
- Don't modify App.jsx or the event data flow
- Don't add new npm dependencies (Three.js post-processing is built-in)
- Don't try to build aurora effects, jet streams, or pressure systems yet —
  those are Phase 2 after bloom is proven
- Don't break auto-rotate — it should still spin gently when not interacting

## How to Test

```bash
npm run dev
```

Open http://localhost:5173 — the globe should render with visible bloom glow
on arcs and rings within seconds as mock data streams in. Epic events should
glow brighter than standard ones.

## When You're Done

1. Commit your changes on your branch
2. Tell Mark what you changed and any issues you encountered
3. Note anything that would need Quipu's help (shared file changes, etc.)
