# Proposal 0002 - Digestive Intel Desk

Status: Draft

Preview URL:

- `/?proposal=digestive-intel-desk`

## Why this exists

The app already has a fake ticker, but if the product is going to feel richer it needs a cleaner information architecture around news and context.

This proposal explores a dual-channel desk:

- `Live Ops` for app-native activity
- `Digestive Intel` for real external stories about methane, digestion, gut health, food science, and related topics

## What Claude should review

1. Is the dual-channel split the right structure?
2. Should external stories live in a side panel, ticker, or a separate drill-down view?
3. Should news be purely informational, or influence app copy, challenges, and region highlights?
4. Which server-side ingestion path is best for this codebase?

## What is intentionally fake in this draft

- Headlines are mock data.
- Trust scores are mocked.
- Region correlation notes are mocked.
- No live news service is connected.

## Expected merge targets if accepted

- `server/` for server-side news fetching and caching
- `src/data/` for normalized news client helpers
- `src/components/HUD/` for dual-channel ticker/panel work
- `src/App.jsx` for feed wiring

## Notes

This proposal is about information design first. It tries to keep the app funny while making the news layer feel intentional instead of random.
