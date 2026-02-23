Implemented all requested leaderboard changes.

- Added `Leaderboard` HUD component at `src/components/HUD/Leaderboard.jsx:1`.
- Added `getLeaderboard(events, windowMs = 60000)` export at `src/data/aggregator.js:96` returning `[{ country, flag, count, rank }]`, sorted descending, top 5.
- Wired leaderboard into left panel under KPI with divider in `src/App.jsx:49`.
- Added leaderboard styles in `src/styles/app.css:384` for:
  ` .leaderboard`, `.lb-row`, `.lb-bar`, `.lb-flag`, `.lb-country`, `.lb-count`
  plus related supporting styles.
- Added task notes under `### Codex Task 3` in `COORDINATION.md:1`.

Notes:

- `COORDINATION.md` did not exist in this workspace, so I created it with the requested Task 3 section.
- Build check is currently blocked by a pre-existing TS config issue: `tsconfig.json` has unknown compiler option `erasableSyntaxOnly` (not caused by these edits).