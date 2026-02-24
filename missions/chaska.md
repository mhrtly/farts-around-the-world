# Mission Orders: CHASKA — Star Weaver, HUD Artisan

> You are **Chaska**. Read CLAUDE.md first, then follow these orders.

---

## Your Identity

Named for Venus, the brightest star. You weave the constellation of panels
around the globe. CSS glassmorphism, animations, layout, typography — the
neon sky surrounding Inti's sun.

## Your Terrace

**Files you may edit:**
- `src/components/HUD/*.jsx`
- `src/styles/*.css`
- New files in `src/components/HUD/` if needed

**Files you must NOT edit:** `src/App.jsx`, `src/components/Globe/*`, `server/*`,
`package.json`. If you need new props from App.jsx — stop and tell Mark.

## Branch

```bash
git checkout -b feature/chaska-hud-polish
```

---

## Mission: Make It Feel Like a Classified Intelligence Bunker at 3am

The HUD panels work and look decent. Your job is to make them feel **alive** —
pulsing, breathing, urgent. Someone walks in, sees this dashboard, and thinks
something extremely serious is being monitored.

### Task 1: Breaking News Ticker — HIGH PRIORITY

Add a scrolling news ticker at the very bottom of the screen. This is maximum
comedy-per-line-of-code.

**What it looks like:**
A thin horizontal bar at the very bottom of `.app-shell`, scrolling right-to-left
continuously, styled like a CNN/Bloomberg breaking news ticker.

**Content:** Rotating through absurd flatulence intelligence bulletins. Examples:
```
BREAKING: Unusual methane cluster detected over Northern Finland — authorities monitoring
FLASH TRAFFIC: Embassy staff evacuated in Rome following sustained emission event — diplomatic incident assessment pending
SIGINT INTERCEPT: Munich bratwurst festival correlated with 340% EPM surge — GASCON upgraded to CRITICAL
ADVISORY: Suspicious fart gap detected across Scandinavia — The Council is concerned
ANALYST BRIEF: Pattern analysis suggests coordinated bean consumption across Southern Europe
WEATHER: Prevailing winds carrying methane plume from Buenos Aires toward Montevideo — downwind alert issued
```

**Implementation:**
- Create `src/components/HUD/NewsTicker.jsx`
- Use CSS `@keyframes` with `translateX` for smooth infinite scroll
- Double the text content so the scroll loops seamlessly
- Style: dark background (`var(--bg-0)`), red "BREAKING" prefix with glow,
  white text, thin red top border
- Keep it a single line, ~28px tall
- The ticker should pull random messages from a ticker array (define inline
  or in `src/config/humor.ts` if you want — humor.ts is shared so note it
  in your summary and Mark can coordinate)

**CSS reference (add to a new section in `src/styles/app.css` or `panels.css`):**
```css
.news-ticker {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 28px;
  background: var(--bg-0);
  border-top: 1px solid rgba(255,64,90,0.3);
  overflow: hidden;
  z-index: 100;
  display: flex;
  align-items: center;
}
```

**To render it:** You'll need Mark to add `<NewsTicker />` to App.jsx. Just
build the component, tell Mark it's ready, and he'll wire it in.

### Task 2: GASCON Indicator Animation — HIGH PRIORITY

The GASCON threat bar already works (`GasconIndicator.jsx`) but the lit blocks
are static. Make them **pulse and breathe** so they feel alive.

**What to add:**
- Lit blocks should pulse with a subtle opacity animation (0.7 → 1.0, ~2s ease)
- At MAXIMUM/CRITICAL levels, the entire strip should have a subtle border glow
  that throbs
- The level label text should glow stronger at higher threat levels
- When a level change happens (the `flash` state already exists), add a brief
  screen-edge vignette flash — a red glow at the edges of the strip that fades

**CSS approach — add keyframes to `src/styles/animations.css`:**
```css
@keyframes gascon-pulse {
  0%, 100% { opacity: 0.75; }
  50% { opacity: 1; }
}

@keyframes gascon-critical-glow {
  0%, 100% { box-shadow: 0 0 8px var(--gascon-glow), 0 0 2px var(--gascon-color); }
  50% { box-shadow: 0 0 16px var(--gascon-glow), 0 0 4px var(--gascon-color), 0 0 24px var(--gascon-glow); }
}
```

Apply `gascon-pulse` to `.gascon-block--lit` and `gascon-critical-glow` to
the strip when at levels 1-2. The component already uses `--gascon-color`
and `--gascon-glow` CSS variables, so you can reference those.

### Task 3: Waveform Annotations — MEDIUM PRIORITY

The MethaneWaveform canvas draws a live waveform. Add small pop-up annotation
labels on amplitude spikes. When the waveform hits a high point, briefly show
a small text label near the peak.

**Approach:**
- In the `draw()` function, after rendering the waveform, check for peaks
  in the samples array (values > 0.6)
- At those x positions, render small text labels on the canvas using `ctx.fillText`
- Pick from a short array of funny labels:
  `"CARBONARA INCIDENT"`, `"BEAN SURGE"`, `"DAIRY EVENT"`, `"BURRITO CLUSTER"`,
  `"POST-LUNCH SPIKE"`, `"SUSPICIOUS UPLIFT"`, `"CURRY CORRELATION"`
- Labels should fade in and out (use alpha based on the sample value)
- Keep them small (9px font) so they don't overwhelm the waveform
- Don't show more than 2 labels at once

### Task 4: Event Feed Micro-Polish — LOW PRIORITY (if time allows)

In `EventFeed.jsx`, add:
- A subtle slide-in animation when new events appear at the top
- A tiny colored dot before each event matching its type color (cyan/pink/lime)
- Consider adding the randomly-selected reporter alias from `humor.ts`
  (e.g., "BEANSTALK reported from DE")

---

## What NOT to Do

- Don't touch the globe (that's Inti's terrace)
- Don't modify App.jsx — just build components, Mark will wire them in
- Don't add new npm dependencies
- Don't build country dossier modals or Fart Gap panels yet — those are Phase 2
  and need backend data support from Wari first
- Don't over-animate — the app should feel like a serious intelligence dashboard
  that happens to track farts, not a cartoon

## Design Tokens Reference

All in `src/styles/tokens.css`:
```css
--bg-0: #06090d
--bg-1: #0b1118
--panel-glass: rgba(16,26,38,0.42)
--accent-cyan: #38f3ff
--accent-lime: #9dff4a
--accent-pink: #ff64ff
--accent-amber: #ffb020
--accent-red: #ff4d5a
```

Font stack: `'IBM Plex Mono', 'SF Mono', monospace` (check existing CSS)

## How to Test

```bash
npm run dev
```

Open http://localhost:5173 — verify:
- GASCON blocks pulse when lit
- News ticker scrolls smoothly at the bottom
- Waveform shows labels on spikes when events cluster
- Nothing is broken — all existing panels still render correctly

## When You're Done

1. Commit your changes on your branch
2. Tell Mark: "NewsTicker.jsx is ready — needs `<NewsTicker />` added to App.jsx"
3. List any files outside your terrace that need changes
