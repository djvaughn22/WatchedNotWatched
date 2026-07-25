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

`/` (search-first home + Top-100 links + library snapshot) · `/search` ·
`/top` (Top 222 board: all time × decades × genres, drag/tap into Watched vs Not Watched
columns with a live scoreboard; horror + adult excluded from every query) ·
`/library` (views, filters, sort, bulk actions, export) · `/saved` → redirects
to `/library` · `/title/[source]/[id]` · `/about` · `/legal` · APIs:
`/api/search`, `/api/title`, `/api/similar`, `/api/trailer`, `/api/top`.

Statuses are three: `want_to_watch` / `watched` / `prob_not` ("Prob Not" =
never watched, not interested — distinct from Not for Me = watched and hated).
One color per decision everywhere: Watched cyan `#22D3EE`, Want to Watch blue
`#60A5FA`, Prob Not slate `#64748B` (`TriageButtons.tsx`).

Known Next 16 gotcha: a `Suspense` + `useSearchParams` boundary can postpone
at dev SSR and never resume (page stuck on fallback, no errors). `/top` reads
deep links from `window.location` on mount instead.

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

## For You AI recommendations (added 2026-07-24)

`/foryou` was rebuilt as "What should I watch next?" — four modes (Best
Match / Something Different / Watch Together / Quick Watch), five cards max,
cold-start starter screen, on-device feedback loop, preferences + privacy
controls. Old `/api/recommend` (Homepage deck) is untouched.

**Hybrid engine** (`src/lib/recommendations/` + `/api/recommendations`):
retrieval from TMDB (seed graph + discover top-up) → hard filters (watched,
dismissed, media type) → deterministic documented scoring → detail enrichment
(genres/runtime/rating/providers) → content/runtime filters → optional AI
layer. The AI (OpenAI Responses API via the official `openai` SDK,
server-only, default model `gpt-5.4-nano`, override with
`OPENAI_RECOMMENDATIONS_MODEL`; swapped from Anthropic 2026-07-24 to use
DJ's existing OpenAI credits) only reranks and
explains candidates it was handed by id; `validate.ts` rejects any invented
id, duplicate, missing guide field, or spoiler tell, and malformed responses
fall back to the deterministic template cards. Match labels come from score
thresholds documented in `rank.ts` — no fake percentages.

**Cost model (fails closed).** With no env vars set, the AI layer is OFF and
the page is deterministic-only ($0 — TMDB attribution only). Gates in order:
`AI_RECOMMENDATIONS_ENABLED` + `OPENAI_API_KEY` → entitlement
(`AI_RECOMMENDATIONS_TEST_MODE=true` is the temporary testing plan; there is
no billing, so with `AI_RECOMMENDATIONS_REQUIRE_ENTITLEMENT=true` and test
mode off, NO visitor can trigger an AI call) → per-device daily limit
(`AI_RECOMMENDATIONS_DAILY_LIMIT`, default 5, IP backstop 4x) → 6h response
cache + in-flight dedupe keyed by taste-profile hash. Counters/cache are
in-memory per instance (documented as approximate). Private testing config:
ENABLED=true, TEST_MODE=true, REQUIRE_ENTITLEMENT=false. Production launch
later: TEST_MODE=false, REQUIRE_ENTITLEMENT=true — entitlement then needs a
real plan lookup in `entitlement.ts` `resolveRecPlan()` once billing exists
(and TMDB's commercial license FIRST, per the monetization gate above).

**Privacy.** Library never leaves the device; requests carry only seeds
(liked title ids), a compact genre/tone profile, and exclude ids. Controls on
the page: personalization off, reset history, clear preferences. New
localStorage keys: `wnw.recprefs.v1`, `wnw.recfeedback.v1`, `wnw.device.v1`.

**Tests:** `src/lib/recommendations/*.test.ts` — ranking/filters, AI response
validation, entitlement fail-closed, rate limits, cache/dedupe, profile
building, bounded request sanitizing, and static security guardrails (key
only in server config, no client imports of server AI modules).
