# Editorial Module Pack

Date: 2026-03-07

Purpose: provide Claude with drop-in, source-backed modules that can be integrated into the main app without dragging in an entire proposal wholesale.

## What Exists

Reusable modules live in `src/contentModules/editorial/`:

- `WordAtlasModule`
- `ScienceFieldGuideModule`
- `HistoryTimelineModule`
- `VintageClippingsModule`
- `EmotionalJourneyWidgetsModule`

Exports:

- `src/contentModules/editorial/index.js`

Styles:

- `src/contentModules/editorial/editorialModules.css`

Data:

- `src/contentModules/editorial/editorialData.js`

## Why These Modules Matter

They help the app feel like a journey rather than a joke with extra tabs.

Recommended emotional sequence:

1. `EmotionalJourneyWidgetsModule`
   - sets tone
   - supports onboarding or soft transitions
2. `WordAtlasModule`
   - delivers immediate delight and cultural curiosity
3. `HistoryTimelineModule`
   - creates continuity and wonder
4. `ScienceFieldGuideModule`
   - grounds the experience in reality
5. `VintageClippingsModule`
   - gives the app archive texture and weird newspaper energy

## Integration Pattern

Example:

```jsx
import {
  EmotionalJourneyWidgetsModule,
  HistoryTimelineModule,
  ScienceFieldGuideModule,
  VintageClippingsModule,
  WordAtlasModule,
} from './contentModules/editorial'
import './contentModules/editorial/editorialModules.css'
```

These modules are intentionally:

- self-contained
- prop-light
- easy to place in a route, drawer, dossier, or side panel
- not wired to live backend data yet

## Best Uses

### `WordAtlasModule`

Use for:

- onboarding curiosity panel
- cultural sidebar
- detail-page easter egg
- rotating hero content

### `ScienceFieldGuideModule`

Use for:

- grounding after comedy-heavy content
- digest/intel mode
- educational side rail

### `HistoryTimelineModule`

Use for:

- archive page
- full-screen museum mode
- country or culture brief supplements

### `VintageClippingsModule`

Use for:

- archive drawer
- “from the papers” widget
- weird historical context strip

### `EmotionalJourneyWidgetsModule`

Use for:

- onboarding
- command deck support widgets
- commons/repair mode transitions

## Content Notes

- Language terms are curated from Wiktionary translation material and should be treated as approximate, everyday, and region-sensitive rather than legally definitive.
- Science cards are paraphrased from NIDDK, MedlinePlus, and Britannica.
- Archive and history items are paraphrased from Britannica, the Public Domain Review, and Library of Congress newspaper pages.

## Preview

See proposal:

- `proposals/0005-editorial-atlas.md`

Preview URL:

- `/?proposal=editorial-atlas`
