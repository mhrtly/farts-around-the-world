# Proposal 0005 - Editorial Atlas

Status: Draft

Preview URL:

- `/?proposal=editorial-atlas`

## Why this exists

This proposal is a showcase for reusable modules rather than one giant app concept.

It bundles:

- language
- history
- science
- archive clippings
- emotional-journey widgets

into components that Claude can import individually later.

## What Claude should review

1. Which modules are strong enough to merge early?
2. Which module should live in the main shell versus a future route or dossier?
3. Is the emotional sequencing right: laugh, wonder, ground, then offer care?
4. Which content needs stronger sourcing or editorial refinement before production use?

## What is intentionally fake in this draft

- no live backend data
- no CMS
- no localization pipeline
- no real widget interactivity yet

## Expected merge targets if accepted

- `src/contentModules/editorial/`
- `src/components/HUD/`
- `src/App.jsx`
- `src/styles/`

## Notes

This is designed to make Claude's job easier: he can accept one module, three modules, or the whole lane.
