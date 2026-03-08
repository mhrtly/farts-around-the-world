# Pit Crew Support Note

Date: 2026-03-07

Purpose: give Claude a clean, non-destructive workflow for reviewing and selectively merging Codex-built draft work.

## What Codex Added

Codex added an opt-in proposal sandbox:

- normal app path still loads by default
- draft previews only render when `?proposal=<id>` is present
- proposal implementation files live under `src/proposals/`
- proposal review notes live under `proposals/`

Current entrypoint wiring:

- `src/main.jsx` checks the `proposal` query param
- if present, it loads `src/proposals/ProposalPreviewRoot.jsx`
- otherwise it loads the real app as usual

## Why This Helps

This allows Codex to support the project by:

- building draft UI concepts
- mocking product flows before backend approval
- creating merge-ready slices without forcing them into production
- teeing up options for Claude to inspect, refine, or reject

## Current Draft Proposals

1. `my-farts-control-center`
   - preview URL: `/?proposal=my-farts-control-center`
   - review note: `proposals/0001-my-farts-control-center.md`
   - focus: ownership, self-delete, under-review state, account upgrade flow

2. `digestive-intel-desk`
   - preview URL: `/?proposal=digestive-intel-desk`
   - review note: `proposals/0002-digestive-intel-desk.md`
   - focus: real-world digestion/methane/gut-health news layer with dual-channel ops/news structure

3. `planetary-signal-deck`
   - preview URL: `/?proposal=planetary-signal-deck`
   - review note: `proposals/0003-planetary-signal-deck.md`
   - focus: World Monitor-inspired dashboard composition, presets, command surfaces, and dossier-style drilldowns

4. `atmosphere-commons`
   - preview URL: `/?proposal=atmosphere-commons`
   - review note: `proposals/0004-atmosphere-commons.md`
   - focus: shared-humanity framing, positive rituals, acts of repair, and environmental care loops

5. `editorial-atlas`
   - preview URL: `/?proposal=editorial-atlas`
   - review note: `proposals/0005-editorial-atlas.md`
   - focus: easy-to-integrate content modules for language, history, science, archives, and emotional flow

## Merge Guidance For Claude

When reviewing a proposal:

1. Evaluate the product shape first, not just the pixels.
2. Lift only the accepted pieces into the main app path.
3. Prefer splitting accepted work into:
   - data model/API changes
   - app-shell integration
   - component-level UI
   - styles/tokens
4. Do not merge mock data into production code paths.
5. If a proposal implies backend shape changes, land schema/API work before wiring UI.

## Recommended Acceptance Labels

Use these labels in future review notes or comments:

- `accept`
- `accept with changes`
- `hold for later`
- `reject`

## Safe Working Rule

Proposal previews are for exploration. Production code should only absorb approved fragments, not entire draft directories by default.
