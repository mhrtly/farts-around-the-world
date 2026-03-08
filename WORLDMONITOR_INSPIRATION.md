# World Monitor Inspiration Notes

Date: 2026-03-07

Source references:

- https://github.com/koala73/worldmonitor
- https://www.worldmonitor.app

Purpose: extract transferable dashboard ideas from World Monitor and adapt them to `Farts Around The World App` without flattening this project into a generic clone.

## What World Monitor Gets Right

### 1. It is a dashboard, not just a map with decorations

The map is one system among several:

- signal feeds
- scoring
- filters
- presets
- dossiers
- command surfaces

Takeaway for this app:

- the globe should remain central, but the product should also have genuine operator surfaces around it
- users should be able to filter, compare, replay, investigate, and manage, not just look at points

### 2. It separates information channels cleanly

From the repo README:

- live news/video
- scoring and detection
- map layers
- country briefs

Takeaway for this app:

- split internal fart telemetry from external digestive/methane/gut-health context
- split creator management from public discovery
- split entertainment layers from moderation/state layers

### 3. It uses presets, not just raw controls

World Monitor highlights:

- regional presets
- time filters
- toggleable layers
- shareable URL state

Takeaway for this app:

- add region presets like `Global`, `Americas`, `Europe`, `Spice Belt`, `Night Shift`, `Festival Hours`
- add time windows like `1h`, `6h`, `24h`, `7d`
- add filter chips like `audio only`, `epic only`, `under review`, `top rated`, `new uploads`
- encode major state in the URL when the real app grows up

### 4. It turns data into dossiers

World Monitor uses country brief pages and intelligence summaries.

Takeaway for this app:

- selected region or country should open a dossier panel
- selected fart should open a richer event spotlight
- creator accounts should have an upload dossier view

Possible dossier sections:

- GI Pressure Index
- trending emitters
- top-rated clips
- audio density
- report rate
- nearby digestive intel stories

### 5. It feels like software for operators

Useful World Monitor patterns:

- command palette
- layered layouts
- high-density summaries
- strong visual grouping

Takeaway for this app:

- give this app a command surface, not just buttons
- add a command palette for:
  - jump to country
  - toggle audio-only view
  - open my uploads
  - open moderation queue
  - switch map modes
  - jump to top-rated or newest events

### 6. It has multiple product variants from one codebase

World Monitor exposes multiple themed variants from a shared base.

Takeaway for this app:

This app could eventually support variants without splitting the codebase:

- `Mission Control` for the full war-room dashboard
- `Capture Mode` for mobile recording and quick upload
- `Archive Mode` for browsing, playlists, and legendary clips
- `Digestive Intel` for news/context-heavy exploration

## What Not To Copy Blindly

### Do not replace the joke with generic seriousness

World Monitor is credible because it is actually about geopolitical intelligence.
This app works because the seriousness is intentionally disproportionate to the subject.

Borrow:

- structural clarity
- operator tooling
- layout density
- rich drilldowns

Do not borrow:

- generic geopolitical language that stops being funny
- clutter for its own sake
- dozens of toggles with no meaningful user value

### Do not add every possible data layer

World Monitor can justify many layers because it aggregates many real-world systems.

This app should keep layers tightly related to the product:

- fart events
- audio-bearing events
- community rating heat
- moderation/report overlays
- digestive intel overlays
- temporal replay
- cuisine/caption metadata once it exists

## Concrete Product Features To Borrow And Adapt

### Regional presets

Possible presets:

- `Global`
- `North America`
- `Europe`
- `Latin America`
- `After Dinner`
- `Commute Hours`
- `Festival Zones`
- `Quiet Anomalies`

### Scoring systems

Borrow the idea of composite scores, but make them fit the app:

- `Global Flatulence Index`
- `Authenticity Confidence`
- `Community Delight`
- `Digestive Volatility`
- `Report Risk`

### Drilldown briefs

Add:

- country briefs
- city briefs
- event spotlight cards
- creator upload dossiers

### Shareable state

Worth adding later:

- share a view with selected filters, region, and timeframe in the URL
- share "best of today in Brazil" or "audio-only epic events in Europe"

### Command palette

High-value addition for a dashboard-heavy product:

- fast navigation
- filter toggles
- view switching
- hidden power without UI clutter

### Multi-channel feed design

Suggested feed channels:

- `Live Ops`
- `Digestive Intel`
- `Community`
- `Moderation`

## Best Adaptation For This Repo Right Now

Near-term, the best World Monitor-inspired additions are:

1. command-deck layout proposal
2. region presets and time filters
3. dossier-style event and region panels
4. dual-channel intel/news system
5. command palette proposal

That sequence adds real dashboard power without blowing up the current codebase.
