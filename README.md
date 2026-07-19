# WatchedNotWatched (watchednotwatched.com)

What to watch next, based on what you like. Rate titles Watched✓/NotWatched, get a re-dealt deck of picks, browse the Top 22/222 board. Free; personal media product.

## Repo map

- **Production:** https://watchednotwatched.com — branch `main`, auto-deploys on push (Vercel).
- **Framework:** Next.js 16.2.9 (App Router). Build: `npm run build`. Tests: `npm test`.
- **Routes:** `/`, `/about`, `/foryou`, `/top`, `/library`, `/saved`, `/search`, `/legal`, plus `/api/recommend`, `/api/subscribe`, and `/api/guidance` (the "Do I Want to Watch This?" decision card).
- **Family chrome:** `src/app/OpenMirrorNav.tsx` / `OpenMirrorFooter.tsx` / `OpenMirrorTheme.tsx` are synced copies — canonical source is the hub repo `packages/openmirror-ui/` + `scripts/sync-ui.sh`. Never edit the local copies.
- **Theme:** family ☀️/🌙 toggle; `om-theme` localStorage key.
- **Persistence (localStorage):** `wnw.status.v1`, `wnw.saved.v1`, `wnw.recent.v1`, `wnw.library.v2`, `wnw.email.v1`, `wnw.tally.v1`, `wnw.prefs.v1` (viewing preferences — this device only).
- **Env vars (names only):** `TMDB_API_KEY`, `TMDB_ACCESS_TOKEN`, `DEFAULT_WATCH_REGION`, `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, `YOUTUBE_API_KEY`, `ANTHROPIC_API_KEY` (decision-card guidance; feature shows a graceful "not switched on" state without it), optional `WNW_AI_MODEL` (default `claude-opus-4-8`), plus guidance safeguards `WNW_GUIDANCE_BETA_ENABLED` (unset = beta on; `0` ends the free beta → typed `entitlement_required`, no AI call), `WNW_GUIDANCE_KILL_SWITCH` (owner emergency stop, no UI change needed), `WNW_GUIDANCE_DAILY_LIMIT` (default 200/day), `WNW_GUIDANCE_MONTHLY_BUDGET_USD` (default 25).
- **Business model (no billing built yet):** Free = local-first tracking, no account, stays free with ~zero infra/AI cost. Guide = the "Do I Want to Watch This?" decision card — free only during testing (labeled "Free during testing"), a paid add-on later. Cloud = Guide + accounts, sync, backup, family profiles, shared lists. Entitlement seam: `src/lib/entitlements.ts` (plans `free|guide_beta|guide_paid|cloud_paid`); access policy: `src/lib/guidance/service.ts` (kill switch → entitlement → cache → cost gates → AI). Beta also has a per-device limit of 10 cards/day (`wnw.guidance.usage.v1`, browser-only — honest guardrail, not tamper-proof).
- **External services:** TMDB (ratings/metadata; commercial license required before charging money), Resend (email list — hidden until keys are set in Vercel), Anthropic (server-side only, generic per-title guidance, cached; personalization is computed on-device), GA4.
- **Decision card:** generic spoiler-free guidance per title from `/api/guidance` (server AI, edge+memory cached); the personal verdict comes from `src/lib/guidance/personalize.ts` running in the browser against `wnw.prefs.v1` — preferences never leave the device.
- **Protected:** the focused MVP direction. No family-filter promises, no streaming/playback claims, no provider-coverage claims beyond what the code really does.
- **Make changes in:** `src/app/page.tsx` (home deck), `src/lib/` (ranking).
