# WatchedNotWatched — MVP1 Audit

_Date: 2026-07-09 · Framework: Next.js 16.2.9 (App Router) · React 19 · Tailwind v4 · TypeScript_

## Current working functionality (before MVP1 work)
- **TMDB search** via `src/app/api/search/route.ts` (server route, `TMDB_API_KEY`, graceful no-key). Kept and upgraded.
- **TVmaze** show search + metadata (client-side) in `WatchCompanion`. Free, no key. Useful for posters/metadata.
- **OMDB** movie metadata (client-side, `NEXT_PUBLIC_OMDB_API_KEY`). Works but **exposes a key in the client bundle** (see below).
- **Local storage**: early-access email, "lifetime filtered" counter.
- Shared Open Mirror chrome (nav/footer/theme) — synced from hub, not owned here. Left untouched.

## Broken / mocked / non-compliant functionality (fixed in MVP1)
1. **Fabricated scene timestamps on real copyrighted films.** `src/data/titles.ts` invents per-second `mute`/`skip` events for _The Bear, Stranger Things, Top Gun: Maverick, The Avengers, Barbie, Moana 2_. This violates "do not fabricate content reviews or scene timestamps" and implies a review database that does not exist. **Removed from the product path.** Filter data now exists only as owner-authored manifests against demo/sample video.
2. **False claim:** homepage said _"Community members have already mapped out every f-bomb, sex scene, and gore moment — down to the second."_ Untrue. **Removed.**
3. **Implied capability:** `/watch` is a "your phone tells you when to press mute/skip on your own Netflix/Disney+ stream" companion driven by the fabricated timestamps. It never controls any video. This blurs into an unsupported filtering claim on protected streams. **Replaced** by an honest **Filter Lab** that performs _real_ mute/skip on a licensed/owner demo video, plus a **Watch Guide** that only does honest search + guidance + handoffs.
4. **Fake pricing / CTAs:** `$9.99` / "Become a Founding Member" buttons linking to an email box. Pricing is now behind `FEATURE_PRICING` and out of primary nav until it is truthful.
5. **Off-brand visuals:** violet/rose/amber + gradients contradict the project's own rules (cool/flat, cyan `#22D3EE`, **no red, no gradients**). Rebuilt on-brand.
6. **Client-exposed key:** `NEXT_PUBLIC_OMDB_API_KEY`. Metadata now flows through server routes; no metadata key ships to the client.

## Current data sources
| Source | Role | Key | Commercial note |
|---|---|---|---|
| TMDB | search, movie/tv details, posters, watch-provider list (JustWatch data) | `TMDB_ACCESS_TOKEN` (server) | Dev key does **not** clear commercial launch. Attribution required (TMDB + JustWatch). |
| TVmaze | supplementary TV metadata | none | Free, attribution-friendly. |
| YouTube Data API | trailer lookup | `YOUTUBE_API_KEY` (server, optional) | Graceful no-key. |
| Local sample catalog | offline/dev fallback | none | Marked `sample`/`editorial` internally; never shown as live availability. |

## Licensing concerns (must resolve before commercial launch)
- TMDB/JustWatch data licensing for a revenue product (dev key ≠ commercial rights).
- No authorized filterable commercial catalog exists. Automatic filtering is legally limited to **owner-authored / public-domain / licensed** media (Filter Lab demo).
- Legal review required before any subscription launch.

## Architecture after MVP1
- **Normalized media model** (`src/lib/media/*`) — UI consumes internal `MediaTitle`; external shapes stay inside adapters (`MediaMetadataAdapter`). TMDB is a replaceable adapter.
- **Player-agnostic Filter Engine** (`src/lib/filter/*`) — `ControllablePlayer` interface + HTML5 adapter; validated, versioned `FilterManifest`.
- **Local-first profiles / guidance / compatibility** (`src/lib/profiles.ts`, `guidance.ts`, `compatibility.ts`).
- **Provider registry + honest handoff builder** (`src/lib/providers/*`) — capability-typed; labels match the real action; domain allowlist.
- Routes: `/` (search-first), `/search`, `/title/[source]/[id]`, `/filter-lab`, `/studio/filters` (flagged), `/saved`, `/profiles`, `/about`, `/legal/*`.

## Highest-value changes (implementation order)
1. Remove fabricated copyrighted timestamps; establish normalized types + manifest format + validation (+ tests).
2. Build the real Filter Engine + HTML5 adapter (+ tests).
3. Build the Filter Lab on a licensed/owner demo video.
4. Build the Filter Studio (flagged) — author/export/import manifests.
5. Rebuild search + title detail (TMDB adapter, resilient, honest guidance).
6. Profiles + compatibility explanations.
7. Provider registry + honest handoffs (+ tests).
8. YouTube trailers (server, graceful no-key).
9. Saved titles + sharing.
10. Homepage + About + legal + mobile/a11y polish.
11. Docs + `.env.example`.

## Deferred from MVP1 (see `docs/mvp2-provider-path.md`)
- Any protected-stream playback control or "account connected" state.
- Real payments / checkout.
- Full editorial guidance catalog (only official-rating + not-reviewed states ship now).
- Browser extension, native TV/mobile apps, desktop local-media player.
