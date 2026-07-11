# WatchedNotWatched — Handoff

_Updated: 2026-07-10 · Next.js 16.2.9 App Router · React 19 · Tailwind v4 · TypeScript strict · Vitest_

## Product definition

WatchedNotWatched helps families know what is in a movie or show, decide what to avoid, mark titles Watched / Not Watched / Saved for later, and — for supported media — watch through the WatchedNotWatched player with automatic filtering applied.

## Accurate public claims

- Search movies and shows (TVmaze + Wikidata + local sample catalog).
- See content guidance status honestly (Reviewed / In review / Basic info / Not reviewed).
- Set a family profile; see how a title fits ("Not enough information" when unreviewed).
- Mark titles Watched / Not Watched / Save for later; persists on this device.
- Watch with Filter works on ONE title today: the bundled CC-BY demo clip, with a verified filter track.
- For every other title: "Filtering is not verified for this version." Guidance + provider search links only.
- WatchedNotWatched never connects to, controls, or alters playback from streaming services.

## What works now (verified 2026-07-10)

- **Filter Engine** (`src/lib/filter/engine.ts`): real mute/skip/warn on any `ControllablePlayer`. Verified by playback observation: mute engaged exactly in authored regions, skips jumped past authored regions.
- **Watch with Filter** (`/watch/[mediaId]`): plays authorized media, applies the active profile, verified-edition gate, overlay notices, manual skip, filtering on/off, completion → Mark Watched.
- **Watched / Not Watched / Save for later**: title page buttons, `/saved` ("My titles") merged list with filter chips, localStorage persistence (`wnw.status.v1`, `wnw.saved.v1`).
- **Search**: hybrid local + TVmaze + Wikidata; `?q=` deep links work and stay shareable.
- **Filter Lab** (`/filter-lab`): interactive demo. **Filter Studio** (`/studio/filters`): manifest authoring, gated off in production unless `FEATURE_FILTER_STUDIO=true`.

## Prototype-only / planned

- Editorial drafts are in-memory server state (vanish per instance). "Add to review" button is gated to dev/flag.
- No commercial title has a filter track. That requires licensed/original/PD catalog growth (docs/mvp2-provider-path.md Option D) — NOT a protected-stream browser extension (rejected: legal/fragility, see Option B).
- No accounts, no cross-device sync, no payments. Do not claim them.

## Timestamp-track format (FilterManifest)

`src/lib/filter/types.ts`. v1 fields plus version/verification fields (all optional, validated when present): `edition`, `provider`, `region`, `runtimeSeconds`, `runtimeToleranceSeconds`, `verification {state, verifiedAt, method, notes}`.

**Safety gate:** `canRunAutomaticActions(manifest, actualDuration)` (`src/lib/filter/manifest.ts`) — automatic actions run only when the track is `verified` AND the loaded media's duration matches the authored runtime within tolerance. Mismatch → the watch page shows "Filtering is not verified for this version" and the engine never starts. Never fabricate timestamps for commercial titles.

## Preference model

- Profiles (`src/lib/profiles.ts`, `wnw.profiles.v1`): per-category tolerance thresholds (none-noted → severe).
- `settingsFromProfile` (`src/lib/filter/profileSettings.ts`): an event is filtered when its severity exceeds the profile's threshold; a category with no stated threshold is treated as strictest. Session category toggles on the watch page don't overwrite the profile.

## Registry

`src/data/filterManifests.ts`: `FILTER_MANIFESTS` (tracks by `mediaId`) + `AUTHORIZED_MEDIA` (media we may legally play — owned/licensed/PD/CC only; commercial streams never belong there) + `watchWithFilterAvailable()`. The demo title also lives in `src/data/catalog.ts` (`sample:demo-reel`) so search finds it.

## Supported today

- Browser: desktop + mobile web (Chrome verified).
- Provider: WatchedNotWatched's own player only.
- Titles/editions:
  1. "Filter Demo Reel" — bundled 10s Big Buck Bunny clip (CC-BY 3.0, Blender Foundation), track `demo-reel-v1`, verified 2026-07-10 by manual playback check.
  2. "Steamboat Willie" (1928) — US public domain since 2024-01-01; streams from the Internet Archive (466.7s copy, item `steamboat-willie-1928-by-walt-disney_202401`); track `steamboat-willie-1928-ia-v1`, 6 events authored by frame-by-frame visual inspection of that exact file, verified 2026-07-10. Visual review only — audio (musical score, no dialogue) not separately reviewed. Note: PD status asserted for the US; the stream depends on archive.org availability and fails safely if unreachable.
  3. "The Skeleton Dance" (1929) — US public domain since 2025-01-01; streams from the Internet Archive (331.95s copy, item `videoplayback-5_20260207`); track `skeleton-dance-1929-ia-v1`, 6 events (mostly the "frightening" category — two startle skips, four warns), same frame-inspection method and caveats as above. First title where the Family profile tolerates the whole track while Little Kids gets skips — the threshold system visibly differentiates.

## Privacy / security

localStorage only (`wnw.profiles.v1`, `wnw.saved.v1`, `wnw.status.v1`, `wnw.recent.v1`, `wnw.studio.draft.v1`). No analytics, no trackers, no accounts, no credentials, no client-exposed API keys. Server API routes are keyless by default. `/api/editorial/add` is unauthenticated but in-memory only — gate or remove before it matters.

## Legal / cost questions

- TVmaze data is CC BY-SA with a commercial tier — confirm terms before paid launch.
- Wikidata CC0: safe. YouTube API key optional.
- Current cost: $0. No paid services. Vercel bandwidth is the only scaling concern if longer video is bundled.

## Next development phase

MVP2 Option D: grow the licensed/original/PD catalog. Per title: add media to `AUTHORIZED_MEDIA` (or hosted URL), author its manifest in the Filter Studio, verify timing by playback, register in `FILTER_MANIFESTS` + catalog. Everything else (title page, watch page, statuses) picks it up automatically.

## For the next session

1. Read this file and `docs/mvp2-provider-path.md`.
2. `npm test` (47 tests) · `npx tsc --noEmit` · `npm run build` must stay clean.
3. Push to main = production deploy (Vercel).
4. Do not touch shared Open Mirror chrome here (synced from hub). Do not fabricate timestamps. Do not build a protected-stream extension.
