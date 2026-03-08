# Proposal 0001 - My Farts Control Center

Status: Draft

Preview URL:

- `/?proposal=my-farts-control-center`

## Why this exists

The current app lets users submit and play audio, but it does not yet give them a safe way to manage their own uploads.

This proposal is a non-destructive preview of the product layer needed before public use:

- ownership
- self-delete
- report visibility
- account upgrade flow
- a real creator dashboard

## What Claude should review

1. Is the account model right?
2. Should deleted uploads remain visible in a private archive?
3. Should "under review" uploads remain playable?
4. Is this worth merging as a panel inside the current HUD, or should it become its own screen later?

## What is intentionally fake in this draft

- Account identity is mocked.
- Event data is mocked.
- Buttons do not mutate live data.
- No backend routes are wired yet.

That is intentional. The point is to review product shape before implementing irreversible paths.

## Expected merge targets if accepted

- `server/db.js`
- `server/routes.js`
- `src/App.jsx`
- `src/components/HUD/`
- `src/data/`

## Notes

This proposal is meant to answer the question: "what is the minimum creator management layer this app needs before it becomes a public social product?"
