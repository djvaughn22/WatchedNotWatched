# WatchedNotWatched — Handoff

_Updated: 2026-07-10 · Next.js 16.2.9 App Router · React 19 · Tailwind v4 · TypeScript strict · Vitest_

## Product

A fast personal watch list for movies and TV. Search a title, tap **Watched**
or **Want to Watch**, optionally add **My Take** (Loved it / Liked it / Fine /
Not for me) and **Again?** (Yes / Maybe / No), keep going. Local-first, no
accounts. Hero line: "Remember what you watched. Find what comes next."

The pre-July-2026 family-filtering product (Filter Lab, Watch with Filter,
Studio, profiles, guidance) was removed on DJ's decision. Recover via git tag
`pre-mvp1-reset-2026-07-10`; planning docs live in `docs/archive/`.
Do not revive filtering.

## Routes

`/` (search-first home + library snapshot) · `/search` · `/library` (views,
filters, sort, bulk actions, export) · `/saved` → redirects to `/library` ·
`/title/[source]/[id]` · `/about` · `/legal` · APIs: `/api/search`,
`/api/title`, `/api/similar`, `/api/trailer`.

## Data model (localStorage)

`wnw.library.v2` — `{ version: 2, entries: LibraryEntry[] }`, pure logic in
`src/lib/library.ts` (tested). Entry: status `want_to_watch|watched`, optional
`myTake`, `again`, `addedAt`, `watchedAt`, genres. Views are derived: Watch
Again = watched + again yes/maybe; Favorites = loved; Not for Me = not_for_me.
One-time migration from legacy `wnw.saved.v1` + `wnw.status.v1` runs on first
load (old keys left as backup): saved→want_to_watch, watched→watched,
not-watched→want_to_watch. Corrupted data → empty library.
Other keys: `wnw.recent.v1` (recent searches), `wnw.tally.v1` (sessionStorage
logging count).

## Data sources

- **TMDB** (`src/lib/media/tmdb.ts`, server-only `TMDB_ACCESS_TOKEN`):
  movie+TV search, posters, details, trailers (YouTube ids), watch providers
  (JustWatch data — attribution required and rendered), similar titles.
  **Licensing: free with attribution while the app is non-commercial. Charging
  money requires TMDB's commercial license (~$149/mo) FIRST.**
- **TVmaze** (keyless): TV fallback when no TMDB key is configured.
- **Wikidata**: legacy title-detail ids only.
- `/api/trailer`: optional `YOUTUBE_API_KEY`; degrades to a YouTube search link.
- Provider links: `src/lib/providers.ts` registry + honest handoff builder
  (search links when no verified deep link). No credentials, no embedding.

## Export / share

`src/lib/export.ts` (tested): real CSV / JSON / Markdown downloads (JSON is
restore-ready), Web Share with clipboard fallback, `mailto:` summary (no
attachment claims).

## Monetization gate

Free product, $0 costs today. Before charging (e.g. $1/mo): 1) accounts +
payments build, 2) TMDB commercial license. Breakeven ≈150 subscribers.

## For the next session

1. `npm test` · `npx tsc --noEmit` · `npm run build` must stay clean.
2. Push to main = production deploy (Vercel).
3. Shared Open Mirror chrome (OpenMirrorNav/Footer/Theme) is synced from the
   hub — never edit here.
4. Next feature candidates: JSON import/restore, quick-rate mode for the
   watched pile, PWA install.
