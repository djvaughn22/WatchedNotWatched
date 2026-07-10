# Deployment

Next.js 16 (App Router) on Vercel. Push to `main` triggers a production deploy.

## Commands
```bash
npm install
npm run lint
npx tsc --noEmit
npm test
npm run build     # must pass before shipping / tagging
```

## Environment variables (see `.env.example`)
Set in the Vercel project (all server-side unless noted):
- `CONTENT_METADATA_PROVIDER=tmdb`
- `TMDB_ACCESS_TOKEN` (or `TMDB_API_KEY`)
- `DEFAULT_WATCH_REGION=US`
- `YOUTUBE_API_KEY` (optional)
- `NEXT_PUBLIC_APP_URL` (share links)
- `FEATURE_FILTER_STUDIO=false` (keep Studio off in production unless gated by auth)
- `FEATURE_PRICING=false`

## Graceful degradation
- No `TMDB_*` → search/title fall back to the labeled sample catalog; the app
  still runs (Filter Lab, profiles, saved, navigation all work).
- No `YOUTUBE_API_KEY` → trailer section shows a YouTube search link.

## Shared chrome
`OpenMirrorNav/Footer/Theme` in `src/app/` are **synced from the hub repo** —
never edit them here. Edit in `open-mirror/packages/openmirror-ui/`, run
`scripts/sync-ui.sh`, then rebuild/commit each satellite.

## MVP1 tag
Tag a green build: `watchednotwatched-mvp1-YYYYMMDD-HHMMSS`.
