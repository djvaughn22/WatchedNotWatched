# WatchedNotWatched (watchednotwatched.com)

What to watch next, based on what you like. Rate titles Watched✓/NotWatched, get a re-dealt deck of picks, browse the Top 22/222 board. Free; personal media product.

## Repo map

- **Production:** https://watchednotwatched.com — branch `main`, auto-deploys on push (Vercel).
- **Framework:** Next.js 16.2.9 (App Router). Build: `npm run build`. Tests: `npm test`.
- **Routes:** `/`, `/about`, `/foryou`, `/top`, `/library`, `/saved`, `/search`, `/legal`, plus `/api/recommend`, `/api/subscribe`, and `/api/guidance` (the "Do I Want to Watch This?" decision card).
- **Family chrome:** `src/app/OpenMirrorNav.tsx` / `OpenMirrorFooter.tsx` / `OpenMirrorTheme.tsx` are synced copies — canonical source is the hub repo `packages/openmirror-ui/` + `scripts/sync-ui.sh`. Never edit the local copies.
- **Theme:** family ☀️/🌙 toggle; `om-theme` localStorage key.
- **Persistence (localStorage):** `wnw.status.v1`, `wnw.saved.v1`, `wnw.recent.v1`, `wnw.library.v2`, `wnw.email.v1`, `wnw.tally.v1`, `wnw.prefs.v1` (viewing preferences — this device only).
- **Env vars (names only):** `TMDB_API_KEY`, `TMDB_ACCESS_TOKEN`, `DEFAULT_WATCH_REGION`, `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, `YOUTUBE_API_KEY`, `ANTHROPIC_API_KEY` (decision-card guidance; feature shows a graceful "not switched on" state without it), optional `WNW_AI_MODEL` (default `claude-opus-4-8`).
- **External services:** TMDB (ratings/metadata; commercial license required before charging money), Resend (email list — hidden until keys are set in Vercel), Anthropic (server-side only, generic per-title guidance, cached; personalization is computed on-device), GA4.
- **Decision card:** generic spoiler-free guidance per title from `/api/guidance` (server AI, edge+memory cached); the personal verdict comes from `src/lib/guidance/personalize.ts` running in the browser against `wnw.prefs.v1` — preferences never leave the device.
- **Protected:** the focused MVP direction. No family-filter promises, no streaming/playback claims, no provider-coverage claims beyond what the code really does.
- **Make changes in:** `src/app/page.tsx` (home deck), `src/lib/` (ranking).
