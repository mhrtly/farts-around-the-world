# DESIGN_RESEARCH

## Goal
Pick the best JavaScript globe stack and visual language for a **global fart tracking app** with:
- High-tech visual identity (glassmorphism + neon HUD feel)
- Real-time event storytelling (heat + particle + flow layers)
- Scalable rendering for dense global data

## 1) JS Globe Libraries: Best Options and Trade-offs

### Snapshot recommendation
- **Best default stack:** `Three.js + three-globe (+ deck.gl for heavy overlay layers)`
- **Best geospatially rigorous stack:** `CesiumJS`
- **Best projection/math companion:** `D3-geo`

### Library comparison

| Library | Best for | Strengths | Limitations | Fit for fart tracker |
|---|---|---|---|---|
| **Three.js + three-globe** | Branded 3D globe with custom look | Full rendering/style control; built-in globe layers include arcs, heatmaps, particles, rings, hex bins | You manage more map semantics yourself than Cesium | **Top pick** for cinematic product UX |
| **CesiumJS** | Accurate globe/map + terrain + time-dynamic geospatial data | High-precision WGS84 globe; strong time controls; 3D Tiles ecosystem | Heavier platform; custom “game-like” styling takes extra work | Best if GIS correctness and 3D geospatial standards are core |
| **deck.gl** | High-performance geospatial overlays | GPU-optimized large-data rendering; ready-made Arc/Trips/Heatmap layers | Not a full cinematic globe engine by itself | Excellent overlay engine (especially for dense live data) |
| **D3-geo** | Projection math + spherical geometry transforms | Great-circle and projection utilities; strong geo preprocessing toolset | Not a 3D engine | Great companion for data prep/aggregation logic |

### Practical architecture choices

#### Option A (recommended)
- Render core: `Three.js`
- Globe object/layers: `three-globe` or `globe.gl`
- Heavy overlay layers: `deck.gl` (`ArcLayer`, `TripsLayer`, `HeatmapLayer`)
- Geo preprocessing: `D3-geo`

Why: strongest balance of visual uniqueness + performance + fast iteration.

#### Option B (when geospatial rigor dominates)
- Core: `CesiumJS`
- Use `Entity`/primitives + timeline + 3D Tiles pipeline

Why: better if terrain, strict geospatial correctness, and enterprise GIS workflows are priorities.

## 2) High-Tech UI Aesthetics (Glassmorphism + Neon HUD)

### Visual direction

#### Glassmorphism layer system
- Use translucent panels over the globe (`backdrop-filter: blur(...)` + semi-transparent fills).
- Keep panel backgrounds dark-tinted for contrast and legibility.
- Add subtle border highlights (`1px` alpha strokes) to separate stacked cards.

#### Neon HUD signal style
- Reserve glow for **data signals**, not all UI chrome.
- Use cyan/teal primary glow with amber/red alert channel.
- Add bloom in 3D scene for emissive objects (arcs/markers) via Three.js postprocessing.

#### Suggested token palette
- `--bg-0: #06090d`
- `--bg-1: #0b1118`
- `--panel-glass: rgba(16, 26, 38, 0.42)`
- `--accent-cyan: #38f3ff`
- `--accent-lime: #9dff4a`
- `--alert-amber: #ffb020`
- `--alert-red: #ff4d5a`

### Motion style
- Slow globe drift when idle.
- Event-triggered arc pulse + ring ripple.
- Counter rollup animations for global totals.
- Respect `prefers-reduced-motion` for accessibility fallback.

## 3) Data Viz Options for This App

### A) Heatmaps (where activity is concentrated)
- Use **global density heatmap** for macro signal.
- Good implementations:
  - `three-globe`/`globe.gl` heatmaps layer (spherical KDE-style behavior)
  - `deck.gl HeatmapLayer` (Gaussian KDE, GPU-friendly)
- Add time decay to emphasize recent activity (e.g., last 5-15 minutes weighted higher).

### B) Particles (live event feel)
- Use short-lived particles for incoming events.
- Pair with expanding rings/ripples for “burst” moments.
- Keep a strict particle budget for FPS stability (dynamic cap by device class).

### C) Arcs (flows and correlations)
- Use great-circle arcs between origin and destination regions.
- Map:
  - Arc height -> magnitude
  - Arc width -> confidence/volume
  - Arc color -> event type/severity
- Good implementations:
  - `deck.gl ArcLayer` (supports great-circle rendering)
  - `deck.gl TripsLayer` for animated path playback
  - `three-globe` arcs for more stylized, cinematic treatment

### Recommended layer stack (priority order)
1. Low-opacity heat layer (always on)
2. Arc layer for inter-region flows
3. Particle/ripple layer for fresh events
4. Labels/KPIs only at relevant zoom levels to avoid clutter

## 4) Implementation Notes for Performance

- Target `60fps` desktop, `30-60fps` adaptive on mobile.
- Batch incoming events and update layers on a cadence (e.g., 250-500ms), not per event.
- Add a quality toggle:
  - `High`: bloom + dense particles + long arc trails
  - `Medium`: lighter bloom + reduced particles
  - `Low`: heat + minimal arcs only
- In Cesium mode, use explicit render-loop control features where appropriate (`requestRenderMode` / render-loop tuning).

## Final Recommendation

If the app’s brand is “fun but premium sci-fi telemetry,” start with:
- `Three.js + three-globe` for globe + stylized effects
- `deck.gl` layers for heavy real-time overlays
- `D3-geo` for preprocessing and projection math

Switch to `CesiumJS` only if your roadmap shifts toward terrain-heavy, geospatially strict workflows and 3D Tiles-first needs.

## Sources
- Three.js docs: https://threejs.org/docs/
- Three.js UnrealBloomPass: https://threejs.org/docs/pages/UnrealBloomPass.html
- three-globe (GitHub): https://github.com/vasturiano/three-globe
- three-globe examples/site: https://vasturiano.github.io/three-globe/
- globe.gl docs: https://globe.gl/
- deck.gl intro: https://deck.gl/docs
- deck.gl ArcLayer: https://deck.gl/docs/api-reference/layers/arc-layer
- deck.gl TripsLayer: https://deck.gl/docs/api-reference/geo-layers/trips-layer
- deck.gl HeatmapLayer: https://deck.gl/docs/api-reference/aggregation-layers/heatmap-layer
- CesiumJS (GitHub): https://github.com/CesiumGS/cesium
- Cesium Viewer API: https://cesium.com/learn/ion-sdk/ref-doc/Viewer.html
- Cesium Entity API: https://cesium.com/learn/ion-sdk/ref-doc/Entity.html
- 3D Tiles overview: https://cesium.com/3d-tiles/
- D3-geo overview: https://d3js.org/d3-geo
- D3-geo projections: https://d3js.org/d3-geo/projection
- MDN `backdrop-filter`: https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter
- MDN `<blend-mode>`: https://developer.mozilla.org/en-US/docs/Web/CSS/blend-mode
- web.dev `prefers-reduced-motion`: https://web.dev/prefers-reduced-motion/
