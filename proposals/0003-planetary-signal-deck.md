# Proposal 0003 - Planetary Signal Deck

Status: Draft

Preview URL:

- `/?proposal=planetary-signal-deck`

## Why this exists

This proposal translates the strongest structural ideas from World Monitor into this project's own tone:

- presets
- layered controls
- dossier thinking
- command surfaces
- dense but readable information grouping

The goal is not to copy World Monitor. The goal is to make this app feel like a genuinely powerful dashboard instead of a globe plus a few side panels.

## What Claude should review

1. Does this create a better "operator" feeling than the current shell?
2. Which elements belong in the real app first: presets, filters, dossiers, command palette, or scorecards?
3. Should this become a mode of the app or the main shell evolution?
4. How much density is too much for the joke to stay readable?

## What is intentionally fake in this draft

- all metrics
- all presets
- all layer toggles
- all map and region data

## Expected merge targets if accepted

- `src/App.jsx`
- `src/components/HUD/`
- `src/components/Globe/`
- `src/data/`
- `src/styles/`

## Notes

This is a dashboard-language proposal, not an implementation commitment. It is mainly about composition, affordances, and information design.
