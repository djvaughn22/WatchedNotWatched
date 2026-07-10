# Data Licensing & Attribution

## Default metadata provider — Cinemeta (`src/lib/media/cinemeta.ts`)
- Free, keyless, IMDb-based movie + series search (the service Stremio uses).
- **Required attribution** (rendered on title pages): _"Title metadata from
  Cinemeta (IMDb-based). Ratings are IMDb user scores, not content ratings."_
- Provides title/year/poster/genre/plot/IMDb score — **no** official content
  rating and **no** streaming availability (where-to-watch uses provider search).
- **Commercial note:** confirm terms of use before a paid launch; consider a
  licensed metadata agreement for a revenue product.

## Optional provider — TMDB (`src/lib/media/tmdb.ts`)
- Used preferentially **only when** `TMDB_ACCESS_TOKEN`/`TMDB_API_KEY` is set.
- **TMDB now requires a paid commercial plan for API access** (~$149/mo as of
  2026-07) — it is optional here, not required. Attribution when used:
  _"This product uses the TMDB API but is not endorsed or certified by TMDB."_

## Watch-provider availability — JustWatch (via TMDB)
- TMDB's `watch/providers` data is provided by JustWatch.
- **Required attribution:** _"Streaming availability data provided by JustWatch."_
- We treat these as availability signals, **not** verified direct playback
  links. Handoffs go to a provider search or the TMDB/JustWatch watch page.

## Demo video — Big Buck Bunny
- © Blender Foundation, CC-BY 3.0 (peach.blender.org). Attributed in the Filter
  Lab and Studio. Replaceable with owner-supplied authorized media.

## Sample catalog (`src/data/catalog.ts`)
- Public-domain film metadata, minimal factual fields, `dataStatus: "sample"`.
- Never shown as live provider availability.

## Rules
- No fabricated content reviews or scene timestamps for commercial titles.
- No advisories copied from another commercial review service.
- All secrets stay server-side. Attribution renders in the UI where the data is used.
