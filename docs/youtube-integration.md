# YouTube Trailer Integration

Route: `src/app/api/trailer/route.ts` (server only).

## Setup
1. Create a YouTube Data API v3 key in Google Cloud.
2. Restrict it (API restriction: YouTube Data API v3; HTTP referrer or server
   IP restriction as appropriate).
3. Set `YOUTUBE_API_KEY` as a **server-side** env var. Never `NEXT_PUBLIC_`.

## Behavior
- No key → returns `{ configured:false, trailer:null, searchUrl }`. The title
  page shows a "Search on YouTube" link. Nothing breaks.
- With a key → `search.list` (`type=video`, `videoEmbeddable=true`, 5 results),
  cached 24h (`revalidate: 86400`) to stay quota-conscious, 8s timeout.
- Ranking: prefers a result whose title reads as an official trailer.
- Labeling is conservative: `official: true` **only** when the video title
  contains "official trailer"; otherwise the UI shows "Trailer result".

## We do NOT
- download trailers, scrape transcripts, or classify the full film from a trailer;
- place WatchedNotWatched filtering controls over a YouTube trailer (we have no
  filtering rights over it — the embed is the standard privacy-enhanced player).

Embeds use `youtube-nocookie.com`.
