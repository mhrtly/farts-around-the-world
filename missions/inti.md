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
It looks good. Your job is to make it look **cinematic**.

### Task 1: UnrealBloomPass (Selective Bloom) — HIGH PRIORITY

This is the single highest-impact visual upgrade. Add Three.js post-processing
bloom so that arcs, rings, and epic events GLOW against the dark globe.

**How it works with globe.gl:**
- `globe.gl` exposes its Three.js renderer, scene, and camera via
  `globeInstance.renderer()`, `globeInstance.scene()`, `globeInstance.camera()`
- You need to create an `EffectComposer` with `RenderPass` + `UnrealBloomPass`
- Then replace the default render loop with the composer's render loop
- Use `globeInstance.onAfterRender(() => {})` or override the animation loop

**Implementation approach:**
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
- The `threshold` controls what blooms — set it so only the bright arcs/rings
  bloom, not the entire globe texture
- Make sure to update composer size on window resize
- Test that the atmosphere layer still looks correct with bloom

### Task 2: Intensity-Based Glow Scaling

Once bloom is working, scale the visual intensity:
- Epic events: stronger glow, thicker arcs (you already have different colors)
- High-intensity events (8-10): add emissive boost
- Consider making the `atmosphereColor` pulse briefly when a burst is detected

### Task 3: Click Interaction on Events — MEDIUM PRIORITY

Add the ability to click on an arc or point on the globe and show event details.

**Approach:**
- `globe.gl` supports `onArcClick(arc)` and `onPointClick(point)` callbacks
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
