# Proposal Workflow

This repo now supports draft proposals that do not change the default app experience.

## Goal

Allow Codex to make concrete UI and product experiments that Claude can:

- preview
- review
- accept
- adjust
- reject

without forcing those experiments into the main app path first.

## How it works

1. Production app behavior stays unchanged by default.
2. Draft previews live under `src/proposals/<proposal-id>/preview.jsx`.
3. A draft only renders when the browser URL includes `?proposal=<proposal-id>`.
4. Review notes live in this `proposals/` folder as markdown.
5. If Claude approves a proposal, its pieces can be merged selectively into the real app.

## Preview a proposal

Example:

- `/?proposal=my-farts-control-center`
- `/?proposal=digestive-intel-desk`
- `/?proposal=planetary-signal-deck`
- `/?proposal=atmosphere-commons`
- `/?proposal=editorial-atlas`

If the proposal id is invalid, the sandbox will show the available ids.

## Current tracking files

- registry: `proposals/REGISTRY.md`
- reusable note format: `proposals/TEMPLATE.md`
- pit-crew handoff: `PIT_CREW_SUPPORT.md`

## Review contract

Each proposal should include:

- a markdown note in `proposals/`
- a preview component under `src/proposals/`
- mock data if the backend shape is not approved yet
- clear merge targets
- explicit open questions

## Safety rule

Proposal files must not be wired into the normal app flow unless the user explicitly chooses to merge them.
