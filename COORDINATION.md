# Agent Coordination — Farts Around The World App

> This file is the shared brain. All agents (Claude Code instances + Codex) should read this
> before starting work and update their section when they complete something or learn something useful.

---

## Project Goal
A real-time, high-tech global fart geomap. Sci-fi mission control meets flatulence telemetry.
See `DESIGN_RESEARCH.md` for full library/stack analysis.

## ⚠️ CRITICAL — DO NOT CHANGE THESE FILES
**`package.json`** and **`vite.config.ts`** are LOCKED. DO NOT modify them.
The entire `src/` tree is React JSX + globe.gl. Any agent replacing these with
maplibre-gl / zustand / TypeScript will BREAK THE BUILD. The app is working.
Add features only — do not change the stack.

## Agreed Stack (LOCKED)
- **Bundler**: Vite (vite.config.ts — react plugin + globe.gl optimizeDeps)
- **Framework**: React 18 JSX (src/main.jsx → src/App.jsx)
- **Globe**: `globe.gl` / `three-globe` (Three.js wrapper)
- **Styling**: CSS custom properties, glassmorphism panels, neon HUD tokens
- **Entry point**: `src/main.jsx` (index.html → /src/main.jsx)
- **Root element**: `<div id="root">` in index.html

## Design Tokens
```
--bg-0: #06090d
--bg-1: #0b1118
--panel-glass: rgba(16, 26, 38, 0.42)
--accent-cyan: #38f3ff
--accent-lime: #9dff4a
--alert-amber: #ffb020
--alert-red: #ff4d5a
```

---

## Shared Data Schema

```js
// FartEvent
{
  id: string,          // uuid
  lat: number,         // -90 to 90
  lng: number,         // -180 to 180
  intensity: number,   // 1-10
  country: string,     // ISO 3166-1 alpha-2
  timestamp: number,   // epoch ms
  type: 'standard' | 'epic' | 'silent-but-deadly'
}
```

---

## Haiku Research: Visual Techniques for Stunning Globe (2026-02-23)

**State-of-the-art reference implementations:**
- `three-globe` particle/ring/arc examples: vasturiano.github.io/three-globe/
- Globe.GL demo effects: globe.gl
- Interactive Particles with Three.js: Codrops article
- NASA Eyes on Asteroids: real-time streaming + particles

**Visual techniques that make globes stunning:**

### Particle & Ring Effects
- Use `three-globe`'s built-in particle layers for live event "bursts" — point cloud geometry optimized for speed
- Ring propagations: animated concentric circles expanding outward from event locations
- Particle trails: attach cursor position to texture history with easing functions
- GPU-based particle interactions (via shaders) instead of CPU updates — handles thousands at 60fps

### 3D Rise Effects
- Cylindrical 3D objects rising perpendicularly from globe surface (much more dramatic than flat markers)
- Scale/opacity animation as they rise and fade (tie to event intensity)
- Implement via `three-globe` `objectsData` layer or custom Three.js geometries

### Lighting & Bloom
- Three.js `UnrealBloomPass` postprocessing gives professional glow to arcs, rings, rising objects
- Emissive material on arcs + bloom creates "sci-fi" look
- Glow strength scales with event intensity/severity

### Performance Tuning
- Particle budget (cap total particles, create/destroy dynamically)
- Batch events, update GPU layers every 250-500ms not per-event
- Shader-based effects > CPU updates for large datasets
- Quality levels: High (bloom + dense particles), Medium (lighter bloom), Low (heatmap only)

---

## Cutting-Edge 2026 Techniques (For Maximum Visual Impact)

### GPU-Powered Rendering
- **Three.js Compute Shaders** for complex GPU calculations (physics, particles, data processing)
- **Screen-Space Ambient Occlusion (SSAO)** for cinematic depth perception via GPU
- **Physically-Based Rendering (PBR)** with environment mapping for realism
- **Three.js Shading Language (TSL)** — write shaders in JS/TS, auto-compiles to GLSL/WGSL
- **Cascaded shadow maps** for dynamic lighting on globe + events

### Animation: Motion.js is 2026 Standard
- Motion.js (formerly Framer Motion) — 30.7k stars, actively maintained, React-first
- Supports gesture recognition, scroll triggers, spring physics
- Use for: counter rollups, panel slide-ins, ring pulse animations
- Alternative: React Spring for physics-based spring dynamics (feels more organic)

### Dark Glassmorphism UI (THE 2026 Aesthetic)
- Apple's Liquid Glass on iOS 26 validates this as THE premium look
- Core technique: `backdrop-filter: blur(16px)` + `rgba(bg, 0.15)` panels
- Add ambient gradient orbs (vibrant purples, neon blues) floating behind for depth
- Implement Soft UI buttons (subtle 3D) instead of flat designs
- HUD panels should feel floating over globe, not sitting on top

### Neon/Glow Effects — Pure CSS (No Heavy Assets)
- **Text glow**: `text-shadow` stacking (3-5 shadows with increasing blur radius)
- **Element glow**: `box-shadow` layering or `filter: drop-shadow()` for SVGs
- **Pulsing glow**: `@keyframes pulse` animation (2s ease-in-out infinite)
- **Multi-color glow**: Layer cyan + faint pink for cyberpunk depth
- **Apply to**: event markers, ring propagations, KPI counters on update

### Advanced Data Visualization (2026 Smart)
- **Edge computing principle**: millisecond precision with 250-500ms batch updates
- **Pre-compute highlights**: anomalies, clusters (emphasize them visually)
- **Heatmap decay**: older events fade over 2-5 min (creates visual "now-ness")
- **Correlation display**: show intensity + geography + time simultaneously

### Color Science & Glow Strategy
- **Primary**: Cyan (#38f3ff) for data/arcs
- **Secondary**: Lime (#9dff4a) for contrast pop
- **Alert**: Amber (#ffb020), Red (#ff4d5a)
- **Glow strategy**: Layer shadows on all accents (not just text, but data elements on globe)
- **Dark backgrounds**: Must have color bias (deep blue/purple tint, not pure black) so neon pops

### WebGL/Three.js Advanced (Future-Proof for 2026+)
- **Prepare for WebGPU** migration (better performance than WebGL)
- **Compute shaders** for particle distortion on cursor (GPU-handled, not CPU)
- **Level-of-Detail (LOD)** for globe detail at different zoom levels (performance optimization)
- **Selective bloom**: bloom only emissive objects (arcs, rings), not entire scene (sharper image)
- **Vertex animation** in shaders for "breathing" globe surface or pulsing rings

### HUD Panel Polish
- **Glassmorphism + glow combo**: 16px blur + accent-color border glow
- **Font stack**: Inter or SF Pro (premium feel) with slight letter-spacing
- **Animated icons**: SVG icons with glow on hover
- **Data counters**: Motion.js smooth rollups + text-shadow glow when updating

---

## Implementation Priority (What to Build First)

1. **Globe + Particles** (foundation) — three-globe + UnrealBloomPass
2. **Glassmorphism HUD panels** (aesthetic) — CSS backdrop-filter + glow
3. **Motion.js animations** (feel) — counter rollups, panel transitions
4. **Ring propagations** (data story) — animate outward from events
5. **Heatmap decay** (sophistication) — time-weighted opacity on hot zones
6. **Rising cylinders** (wow factor) — 3D objects on major events
7. **Compute shaders** (performance polish) — particle distortion, advanced effects

---

## How to Run
```bash
npm install
npm run dev
```

---

## Agent Notes
_Drop quick findings, blockers, decisions here with name/date_

(TBD by builders)
